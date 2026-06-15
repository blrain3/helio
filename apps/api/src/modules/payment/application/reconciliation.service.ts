import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { PaymentRepository } from '../infrastructure/payment.repository';
import { MockGateway } from '../infrastructure/mock.gateway';

/**
 * 对账结果条目。
 */
export interface ReconciliationItem {
  merchantOrderId: string;
  localAmount: number;
  localStatus: string;
  statementAmount: number | null;
  statementStatus: string | null;
  /** MATCHED / DISCREPANCY / MISSING_IN_STATEMENT / MISSING_IN_LOCAL */
  result: string;
}

/**
 * 对账服务：本地支付记录 ↕ 第三方支付账单 的日对账。
 *
 * 流程：下载对账单 → 解析 → 匹配 → 差异检测 → 生成对账报告。
 * Mock 场景下，对账单由 MockGateway 生成（模拟渠道侧流水）。
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentRepository,
    private readonly gateway: MockGateway,
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

    // 2. 第三方对账单（Mock 生成：与本地一致的流水 + 模拟一条差异）
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
      });
    }

    // 4. 差异记录持久化
    for (const d of discrepancies) {
      await this.prisma.reconciliationDiff.create({
        data: {
          billDate: date,
          type: d.result,
          detail: d as never,
          status: d.result === 'DISCREPANCY' ? 'DISCREPANCY' : 'PENDING',
        },
      });
    }

    return {
      total: localPayments.length,
      matched,
      discrepancies,
    };
  }

  /**
   * 生成 Mock 对账单（模拟渠道侧流水）。
   * 生产环境此处替换为「下载渠道对账单并解析」。
   */
  private async generateStatement(start: Date, end: Date): Promise<
    Array<{ merchantOrderId: string; amount: number; status: string }>
  > {
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
