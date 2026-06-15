import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ReconciliationRepository } from '../infrastructure/reconciliation.repository';
import { ValidationError, NotFoundError } from '../../auth/domain/errors';
import {
  ReconciliationDiffStatus,
  ReconciliationDiffType,
  canTransitionReconciliationDiff,
} from '../domain/payment.entity';

/**
 * 对账结果条目。
 */
export interface ReconciliationItem {
  merchantOrderId: string;
  localAmount: number;
  localStatus: string;
  statementAmount: number | null;
  statementStatus: string | null;
  /** DISCREPANCY / MISSING_IN_STATEMENT / MISSING_IN_LOCAL */
  result: ReconciliationDiffType;
  /** 关联的本地支付流水 ID（MISSING_IN_LOCAL 无本地流水，为 null）。 */
  paymentId: string | null;
}

/**
 * 对账服务：本地支付记录 ↕ 第三方支付账单 的日对账（闭环，对应方案 C5）。
 *
 * 闭环（避免沦为「只读报表」）：
 *   下载对账单 → 解析 → 匹配 → 差异检测 → 差异落库（PENDING，冻结退款）
 *   → resolveDiff 确认后置 RESOLVED（解锁退款）。
 *
 * 差异关联的支付流水在「未解决（PENDING）」期间，退款会被冻结
 * （见 PaymentService.refund 的冻结检查）。Mock 场景下对账单与本地一致（无差异）；
 * 真实渠道对账单下载在 P2 阶段经 PaymentGatewayProvider.downloadBill 补齐
 * （届时构造注入 gateway）。
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diffs: ReconciliationRepository,
  ) {}

  /**
   * 执行某日的对账。
   * @param date 对账日期（如 2026-09-02）
   */
  async reconcile(date: Date): Promise<{
    total: number;
    matched: number;
    discrepancies: ReconciliationItem[];
  }> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // 1. 本地成功支付记录
    const localPayments = await this.prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        createdAt: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. 第三方对账单（Mock：与本地一致的流水）
    const statement = await this.generateStatement(start, end);

    // 3. 匹配：以 merchantOrderId 为键
    const discrepancies: ReconciliationItem[] = [];
    let matched = 0;

    const statementMap = new Map(statement.map((s) => [s.merchantOrderId, s]));

    for (const local of localPayments) {
      const st = statementMap.get(local.merchantOrderId);
      if (!st) {
        discrepancies.push({
          merchantOrderId: local.merchantOrderId,
          localAmount: local.amount,
          localStatus: local.status,
          statementAmount: null,
          statementStatus: null,
          result: 'MISSING_IN_STATEMENT',
          paymentId: local.id,
        });
        continue;
      }
      if (st.amount === local.amount) {
        matched++;
      } else {
        discrepancies.push({
          merchantOrderId: local.merchantOrderId,
          localAmount: local.amount,
          localStatus: local.status,
          statementAmount: st.amount,
          statementStatus: st.status,
          result: 'DISCREPANCY',
          paymentId: local.id,
        });
      }
      statementMap.delete(local.merchantOrderId);
    }

    // 对账单中存在但本地没有的流水
    for (const st of statementMap.values()) {
      discrepancies.push({
        merchantOrderId: st.merchantOrderId,
        localAmount: 0,
        localStatus: 'N/A',
        statementAmount: st.amount,
        statementStatus: st.status,
        result: 'MISSING_IN_LOCAL',
        paymentId: null,
      });
    }

    // 4. 差异落库：统一 PENDING（冻结关联支付退款），由 resolveDiff 解锁。
    for (const d of discrepancies) {
      await this.diffs.create({
        billDate: date,
        type: d.result,
        detail: d as unknown as Record<string, unknown>,
        paymentId: d.paymentId,
        status: 'PENDING',
      });
    }

    return {
      total: localPayments.length,
      matched,
      discrepancies,
    };
  }

  /**
   * 解决差异：PENDING → RESOLVED，解锁关联支付的退款冻结。
   * 幂等：已 RESOLVED 的差异直接返回，不重复流转。
   */
  async resolveDiff(id: string): Promise<{ id: string; status: ReconciliationDiffStatus }> {
    const diff = await this.diffs.findById(id);
    if (!diff) {
      throw new NotFoundError('对账差异不存在');
    }
    if (diff.status === 'RESOLVED') {
      return { id: diff.id, status: 'RESOLVED' }; // 幂等
    }
    if (!canTransitionReconciliationDiff(diff.status as ReconciliationDiffStatus, 'RESOLVED')) {
      throw new ValidationError(`差异状态不允许从 ${diff.status} 流转到 RESOLVED`);
    }
    const ok = await this.diffs.resolve(id);
    // ok === false 表示并发下已被解决，视为幂等成功。
    return { id, status: 'RESOLVED' };
  }

  /**
   * 生成对账单（当前为 Mock：与本地 SUCCESS 流水一致，无差异）。
   * 生产/P2：替换为「下载渠道对账单并解析」（经 PaymentGatewayProvider.downloadBill）。
   * 声明为 protected 以便测试通过子类注入合成对账单验证差异检测。
   */
  protected async generateStatement(
    start: Date,
    end: Date,
  ): Promise<Array<{ merchantOrderId: string; amount: number; status: string }>> {
    const local = await this.prisma.payment.findMany({
      where: { status: 'SUCCESS', createdAt: { gte: start, lte: end } },
      select: { merchantOrderId: true, amount: true, status: true },
    });
    return local.map((p) => ({
      merchantOrderId: p.merchantOrderId,
      amount: p.amount,
      status: p.status,
    }));
  }
}
