import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ReconciliationRepository } from '../infrastructure/reconciliation.repository';
import { PaymentGatewayProvider } from '../infrastructure/gateway.provider';
import { ValidationError, NotFoundError, ForbiddenError } from '../../auth/domain/errors';
import { PaymentRepository } from '../infrastructure/payment.repository';
import { OrderService } from '../../order/application/order.service';
import { AuthUser } from '../../auth/domain/user.entity';
import {
  RawStatementRow,
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

/** 解析/规范化后的对账行（与本地支付流水对齐的字段）。 */
export interface ParsedStatementRow {
  merchantOrderId: string;
  amount: number;
  status: string;
}

/**
 * 对账服务：本地支付记录 ↕ 第三方支付账单 的日对账（闭环，对应方案 C5）。
 *
 * 闭环（避免沦为「只读报表」）：
 *   下载对账单（经 PaymentGatewayProvider.downloadBill）→ 解析 → 匹配 → 差异检测
 *   → 差异落库（PENDING，冻结退款）→ resolveDiff 确认后置 RESOLVED（解锁退款）。
 *
 * 差异关联的支付流水在「未解决（PENDING）」期间，退款会被冻结
 * （见 PaymentService.refund 的冻结检查）。Mock 渠道的对账单与本地一致（无差异）；
 * WeChat/Alipay 经真实 API 下载（骨架阶段未配置凭据时返回空账单）。
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diffs: ReconciliationRepository,
    private readonly gateway: PaymentGatewayProvider,
    private readonly payments?: PaymentRepository,
    private readonly orders?: OrderService,
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

    // 2. 下载并解析第三方对账单（经 PaymentGatewayProvider 路由到主网关）。
    const statement = await this.downloadStatement(date);

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
  async resolveDiff(
    id: string,
    user: AuthUser,
  ): Promise<{ id: string; status: ReconciliationDiffStatus }> {
    const diff = await this.diffs.findById(id);
    if (!diff) {
      throw new NotFoundError('对账差异不存在');
    }
    await this.assertDiffAccess(diff.paymentId, user);
    if (diff.status === 'RESOLVED') {
      return { id: diff.id, status: 'RESOLVED' }; // 幂等
    }
    if (!canTransitionReconciliationDiff(diff.status as ReconciliationDiffStatus, 'RESOLVED')) {
      throw new ValidationError(`差异状态不允许从 ${diff.status} 流转到 RESOLVED`);
    }
    await this.diffs.resolve(id);
    // resolve 为 updateMany(where status='PENDING')：并发下仅一个命中，未命中视为幂等成功。
    return { id, status: 'RESOLVED' };
  }

  private async assertDiffAccess(paymentId: string | null, user: AuthUser): Promise<void> {
    if (!paymentId) {
      if (user.role !== 'OPERATOR' && user.role !== 'ADMIN') {
        throw new ForbiddenError('无权处理无归属的对账差异');
      }
      return;
    }
    if (!this.payments || !this.orders) {
      throw new Error('Payment and order services are required for reconciliation authorization');
    }
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('支付流水不存在');
    }
    await this.orders.assertOwnedByUser(payment.orderId, user, true);
  }

  /**
   * 下载渠道对账单并解析为规范化行。
   * 下载失败（gateway 抛错）原样上抛，交由上层（worker/BullMQ 重试）处理；
   * 解析失败（格式不符）抛 ValidationError。
   * 声明为 protected 以便测试注入合成对账单验证差异检测与异常场景。
   */
  protected async downloadStatement(date: Date): Promise<ParsedStatementRow[]> {
    const raw = await this.gateway.downloadBill(date);
    return raw.map((row) => this.parseStatementRow(row));
  }

  /**
   * 校验并规范化单行渠道对账单。
   * 格式不符（非对象 / 缺 merchantOrderId / 金额非正整数分 / 状态非字符串）抛 ValidationError。
   */
  protected parseStatementRow(row: RawStatementRow): ParsedStatementRow {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new ValidationError('对账单行格式不符：非对象');
    }
    if (typeof row.merchantOrderId !== 'string' || row.merchantOrderId.trim() === '') {
      throw new ValidationError('对账单行格式不符：缺少 merchantOrderId');
    }
    if (
      typeof row.amount !== 'number' ||
      !Number.isSafeInteger(row.amount) ||
      row.amount < 0
    ) {
      throw new ValidationError(`对账单行金额非法（非正整数分）: ${String(row.merchantOrderId)}`);
    }
    if (typeof row.status !== 'string' || row.status.trim() === '') {
      throw new ValidationError(`对账单行状态非法: ${String(row.merchantOrderId)}`);
    }
    return {
      merchantOrderId: row.merchantOrderId,
      amount: row.amount,
      status: row.status,
    };
  }
}
