import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../infrastructure/payment.repository';
import { PaymentGatewayProvider } from '../infrastructure/gateway.provider';
import { OrderRepository } from '../../order/infrastructure/order.repository';
import {
  PaymentEntity,
  RefundEntity,
  PaymentCallback,
  PaymentProvider,
  PaymentStatus,
  canTransitionPayment,
} from '../domain/payment.entity';
import { EventPublisher, QUEUES } from '../../../infrastructure/queue/event-publisher';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '../../auth/domain/errors';

/**
 * 支付应用服务：支付创建、七步回调链路、退款。
 *
 * 七步回调链路（严格实现，作为项目核心亮点）：
 *   1. 接收回调 → 2. 验签 → 3. 原始通知落库 → 4. 幂等检查
 *   → 5. 金额校验 → 6. 状态机流转 → 7. 发布领域事件 → 8. ACK
 */
@Injectable()
export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly gateway: PaymentGatewayProvider,
    private readonly orders: OrderRepository,
    private readonly events: EventPublisher,
  ) {}

  /**
   * 创建支付（下单）：
   * 1. 校验订单存在且处于 PENDING_PAYMENT 状态；
   * 2. 调用网关 createPayment；
   * 3. 持久化支付流水（初始 PENDING：已提交网关、待回调）。
   *
   * 语义说明：调用了网关下单后，支付已「受理、待回调确认」，
   * 故初始状态为 PENDING（而非 CREATED，CREATED 表示仅建流水未提交网关）。
   * 状态机 PENDING → SUCCESS/FAILED/CLOSED 为合法流转。
   */
  async createPayment(
    orderId: string,
    provider: PaymentProvider,
    notifyUrl: string,
  ): Promise<PaymentEntity> {
    const order = await this.orders.findById(orderId);
    if (!order) {
      throw new NotFoundError('订单不存在');
    }
    if (order.status !== 'PENDING_PAYMENT') {
      throw new ValidationError('订单未处于待支付状态');
    }

    const merchantOrderId = order.orderNo;
    const existing = await this.payments.findByMerchantOrderId(merchantOrderId);
    if (existing) {
      throw new ConflictError('该订单已存在支付流水');
    }

    const result = await this.gateway.createPayment({
      merchantOrderId,
      amount: order.amount,
      notifyUrl,
      description: `订单 ${order.orderNo}`,
    });

    return this.payments.create({
      orderId,
      provider,
      providerTransactionId: result.providerTransactionId,
      merchantOrderId,
      amount: order.amount,
      status: 'PENDING',
    });
  }

  /**
   * 处理支付回调（七步链路）。
   * @returns 处理结果（ACK 内容）
   */
  async handleCallback(callback: PaymentCallback): Promise<{ ack: string }> {
    // 2. 验签
    if (!this.gateway.verifyCallback(callback)) {
      throw new UnauthorizedError('回调验签失败');
    }

    // 3. 原始通知落库（审计，先于幂等判断，保证任何回调都有迹可查）
    await this.payments.createWebhookEvent({
      provider: callback.provider,
      providerTransactionId: callback.providerTransactionId,
      rawPayload: callback.rawPayload,
    });

    // 4. 幂等检查：渠道交易号已存在 → 直接 ACK，不重复处理。
    const existing = await this.payments.findByProviderTransaction(
      callback.provider,
      callback.providerTransactionId,
    );
    if (existing && existing.status === 'SUCCESS') {
      return { ack: 'ok' }; // 幂等：已处理过，直接 ACK
    }
    if (!existing) {
      throw new NotFoundError('支付流水不存在');
    }

    // 5. 金额校验
    if (existing.amount !== callback.amount) {
      throw new ValidationError('回调金额与支付金额不一致');
    }

    // 6. 状态机流转
    if (callback.status === 'SUCCESS') {
      const payment = await this.transitionPayment(existing.id, 'SUCCESS');
      // 联动订单：支付成功 → 订单确认支付（→PAID，并联动账单）。
      await this.orders.updateStatus(payment.orderId, 'PAID');

      // 7. 发布领域事件（M5a：异步结算 / 统计更新）。
      //    以 orderId 作为幂等键，重复回调不会重复入队执行。
      await this.events.publish(QUEUES.SETTLEMENT, {
        name: 'PaymentSucceeded',
        payload: {
          paymentId: payment.id,
          orderId: payment.orderId,
          merchantOrderId: payment.merchantOrderId,
          amount: payment.amount,
          provider: payment.provider,
        },
        idempotencyKey: `settlement-${payment.orderId}`,
      });
    } else if (callback.status === 'FAILED') {
      await this.transitionPayment(existing.id, 'FAILED');
    }

    // 8. ACK
    return { ack: 'ok' };
  }

  /** 关闭支付：PENDING → CLOSED。 */
  async closePayment(paymentId: string): Promise<PaymentEntity> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('支付流水不存在');
    }
    if (!canTransitionPayment(payment.status, 'CLOSED')) {
      throw new ValidationError(`支付状态不允许从 ${payment.status} 流转到 CLOSED`);
    }
    await this.gateway.closePayment(payment.providerTransactionId ?? '');
    return this.transitionPayment(paymentId, 'CLOSED');
  }

  /**
   * 发起退款：
   * 1. 校验支付已 SUCCESS；
   * 2. 校验退款金额 ≤ 可退金额（amount - refundedAmount）；
   * 3. 调用网关 refundPayment；
   * 4. 创建退款单（CREATED）并累计退款金额。
   */
  async refund(paymentId: string, amount: number, refundNo: string): Promise<RefundEntity> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('支付流水不存在');
    }
    if (payment.status !== 'SUCCESS') {
      throw new ValidationError('仅支付成功的流水可退款');
    }
    const available = payment.amount - payment.refundedAmount;
    if (amount <= 0 || amount > available) {
      throw new ValidationError(`退款金额非法，可退金额为 ${available} 分`);
    }

    await this.gateway.refundPayment(
      payment.providerTransactionId ?? '',
      amount,
      refundNo,
    );

    const refund = await this.payments.createRefund({
      paymentId,
      refundNo,
      amount,
      status: 'CREATED',
    });

    await this.payments.addRefundedAmount(paymentId, amount);

    // 全额退款时，支付状态 → REFUNDED。
    if (payment.refundedAmount + amount === payment.amount) {
      await this.transitionPayment(paymentId, 'REFUNDED');
    }

    return refund;
  }

  /** 查询支付。 */
  async findById(id: string): Promise<PaymentEntity> {
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError('支付流水不存在');
    }
    return payment;
  }

  /** 支付状态机流转（校验合法流转后更新）。 */
  private async transitionPayment(id: string, target: PaymentStatus): Promise<PaymentEntity> {
    const payment = await this.payments.findById(id);
    if (!payment) {
      throw new NotFoundError('支付流水不存在');
    }
    if (!canTransitionPayment(payment.status, target)) {
      throw new ValidationError(`支付状态不允许从 ${payment.status} 流转到 ${target}`);
    }
    const updated = await this.payments.updateStatus(id, target);
    if (!updated) {
      throw new NotFoundError('支付流水不存在');
    }
    return updated;
  }
}
