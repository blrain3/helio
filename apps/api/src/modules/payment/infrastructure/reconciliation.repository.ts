import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  ReconciliationDiffStatus,
  ReconciliationDiffType,
} from '../domain/payment.entity';

/** 对账差异记录实体。 */
export interface ReconciliationDiffEntity {
  id: string;
  billDate: Date;
  type: string;
  detail: Record<string, unknown>;
  paymentId: string | null;
  status: string;
  createdAt: Date;
}

/**
 * 对账差异仓储：封装 ReconciliationDiff 表的持久化访问。
 *
 * 「冻结退款」通过 `findPendingByPaymentId` 查询某支付是否存在未解决的差异，
 * 退款服务据此拒绝退款；`resolve` 将差异 PENDING → RESOLVED 解锁。
 */
@Injectable()
export class ReconciliationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ReconciliationDiffEntity | null> {
    const d = await this.prisma.reconciliationDiff.findUnique({ where: { id } });
    return (d as ReconciliationDiffEntity | null) ?? null;
  }

  /** 查询某支付流水当前是否存在「未解决」的差异（退款冻结依据）。 */
  async findPendingByPaymentId(paymentId: string): Promise<ReconciliationDiffEntity | null> {
    const d = await this.prisma.reconciliationDiff.findFirst({
      where: { paymentId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return (d as ReconciliationDiffEntity | null) ?? null;
  }

  async create(data: {
    billDate: Date;
    type: ReconciliationDiffType;
    detail: Record<string, unknown>;
    paymentId?: string | null;
    status?: ReconciliationDiffStatus;
  }): Promise<ReconciliationDiffEntity> {
    const d = await this.prisma.reconciliationDiff.create({
      data: {
        billDate: data.billDate,
        type: data.type,
        detail: data.detail as never,
        paymentId: data.paymentId ?? null,
        status: data.status ?? 'PENDING',
      },
    });
    return d as ReconciliationDiffEntity;
  }

  /**
   * 解决差异：仅当仍为 PENDING 时流转为 RESOLVED。
   * 以 `updateMany + where status` 保证原子性与幂等（并发下只有一个能命中）。
   * @returns 是否成功流转（false = 已非 PENDING，视为幂等成功）。
   */
  async resolve(id: string): Promise<boolean> {
    const result = await this.prisma.reconciliationDiff.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'RESOLVED' },
    });
    return result.count > 0;
  }
}
