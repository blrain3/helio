import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  PaymentEntity,
  RefundEntity,
  PaymentProvider,
  PaymentStatus,
  RefundStatus,
} from '../domain/payment.entity';

/** 支付仓储：封装 Payment / Refund / WebhookEvent 三张表的持久化访问。 */
@Injectable()
export class PaymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== Payment =====================

  async findById(id: string): Promise<PaymentEntity | null> {
    const p = await this.prisma.payment.findUnique({ where: { id } });
    return p ? this.toPaymentEntity(p) : null;
  }

  async findByMerchantOrderId(merchantOrderId: string): Promise<PaymentEntity | null> {
    const p = await this.prisma.payment.findUnique({ where: { merchantOrderId } });
    return p ? this.toPaymentEntity(p) : null;
  }

  /** 按渠道 + 渠道交易号查询（幂等校验用）。 */
  async findByProviderTransaction(
    provider: PaymentProvider,
    providerTransactionId: string,
  ): Promise<PaymentEntity | null> {
    const p = await this.prisma.payment.findUnique({
      where: { provider_providerTransactionId: { provider, providerTransactionId } },
    });
    return p ? this.toPaymentEntity(p) : null;
  }

  async create(data: {
    orderId: string;
    provider: PaymentProvider;
    providerTransactionId: string;
    merchantOrderId: string;
    amount: number;
    status: PaymentStatus;
  }): Promise<PaymentEntity> {
    const p = await this.prisma.payment.create({ data });
    return this.toPaymentEntity(p);
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<PaymentEntity | null> {
    const p = await this.prisma.payment.update({ where: { id }, data: { status } });
    return this.toPaymentEntity(p);
  }

  /** 累计退款金额（原子递增，用于退款金额校验）。 */
  async addRefundedAmount(id: string, amount: number): Promise<PaymentEntity | null> {
    const p = await this.prisma.payment.update({
      where: { id },
      data: { refundedAmount: { increment: amount } },
    });
    return this.toPaymentEntity(p);
  }

  // ===================== Refund =====================

  async findRefundByNo(refundNo: string): Promise<RefundEntity | null> {
    const r = await this.prisma.refund.findUnique({ where: { refundNo } });
    return r ? this.toRefundEntity(r) : null;
  }

  async createRefund(data: {
    paymentId: string;
    refundNo: string;
    amount: number;
    status: RefundStatus;
  }): Promise<RefundEntity> {
    const r = await this.prisma.refund.create({ data });
    return this.toRefundEntity(r);
  }

  async updateRefundStatus(id: string, status: RefundStatus, providerRefundId?: string): Promise<RefundEntity | null> {
    const r = await this.prisma.refund.update({
      where: { id },
      data: {
        status,
        ...(providerRefundId !== undefined && { providerRefundId }),
      },
    });
    return this.toRefundEntity(r);
  }

  // ===================== WebhookEvent =====================

  /** 原始回调报文落库（审计）。 */
  async createWebhookEvent(data: {
    provider: string;
    providerTransactionId: string;
    rawPayload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.webhookEvent.create({ data: { ...data, rawPayload: data.rawPayload as never } });
  }

  // ===================== mappers =====================

  private toPaymentEntity(p: {
    id: string;
    orderId: string;
    provider: string;
    providerTransactionId: string | null;
    merchantOrderId: string;
    amount: number;
    refundedAmount: number;
    status: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentEntity {
    return {
      id: p.id,
      orderId: p.orderId,
      provider: p.provider as PaymentProvider,
      providerTransactionId: p.providerTransactionId,
      merchantOrderId: p.merchantOrderId,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  private toRefundEntity(r: {
    id: string;
    paymentId: string;
    refundNo: string;
    providerRefundId: string | null;
    amount: number;
    status: RefundStatus;
    createdAt: Date;
    updatedAt: Date;
  }): RefundEntity {
    return {
      id: r.id,
      paymentId: r.paymentId,
      refundNo: r.refundNo,
      providerRefundId: r.providerRefundId,
      amount: r.amount,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
