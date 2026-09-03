import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockGateway } from '../infrastructure/mock.gateway';
import { PaymentService } from './payment.service';
import {
  canTransitionPayment,
  canTransitionRefund,
} from '../domain/payment.entity';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '../../auth/domain/errors';

describe('Payment state machine', () => {
  it('合法流转', () => {
    expect(canTransitionPayment('CREATED', 'PENDING')).toBe(true);
    expect(canTransitionPayment('PENDING', 'SUCCESS')).toBe(true);
    expect(canTransitionPayment('PENDING', 'FAILED')).toBe(true);
    expect(canTransitionPayment('PENDING', 'CLOSED')).toBe(true);
    expect(canTransitionPayment('SUCCESS', 'REFUNDED')).toBe(true);
  });

  it('非法流转被拒绝', () => {
    expect(canTransitionPayment('CREATED', 'SUCCESS')).toBe(false);
    expect(canTransitionPayment('SUCCESS', 'PENDING')).toBe(false);
    expect(canTransitionPayment('FAILED', 'SUCCESS')).toBe(false);
    expect(canTransitionPayment('REFUNDED', 'SUCCESS')).toBe(false);
  });

  it('退款状态机', () => {
    expect(canTransitionRefund('CREATED', 'PROCESSING')).toBe(true);
    expect(canTransitionRefund('PROCESSING', 'REFUNDED')).toBe(true);
    expect(canTransitionRefund('PROCESSING', 'FAILED')).toBe(true);
    expect(canTransitionRefund('REFUNDED', 'PROCESSING')).toBe(false);
  });
});

describe('MockGateway', () => {
  const gateway = new MockGateway();

  it('createPayment 生成渠道交易号与支付链接', async () => {
    const result = await gateway.createPayment({
      merchantOrderId: 'ORD1',
      amount: 101234,
      notifyUrl: 'https://x/cb',
    });
    expect(result.providerTransactionId).toMatch(/^MOCK/);
    expect(result.payUrl).toContain(result.providerTransactionId);
  });

  it('verifyCallback：正确签名通过，篡改签名被拒绝', () => {
    const merchantOrderId = 'ORD1';
    const providerTransactionId = 'MOCK1';
    const amount = 101234;
    const signature = gateway.sign(merchantOrderId, providerTransactionId, amount);

    expect(
      gateway.verifyCallback({
        provider: 'mock',
        providerTransactionId,
        merchantOrderId,
        amount,
        status: 'SUCCESS',
        signature,
        rawPayload: {},
      }),
    ).toBe(true);

    expect(
      gateway.verifyCallback({
        provider: 'mock',
        providerTransactionId,
        merchantOrderId,
        amount: 9999, // 篡改金额
        status: 'SUCCESS',
        signature,
        rawPayload: {},
      }),
    ).toBe(false);
  });
});

describe('PaymentService.handleCallback（七步回调链路）', () => {
  const payment = {
    id: 'p-1',
    orderId: 'o-1',
    provider: 'mock' as const,
    providerTransactionId: 'MOCK1',
    merchantOrderId: 'ORD1',
    amount: 101234,
    refundedAmount: 0,
    status: 'PENDING' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const deps = {
    payments: {
      findById: vi.fn(),
      findByMerchantOrderId: vi.fn(),
      findByProviderTransaction: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      addRefundedAmount: vi.fn(),
      createWebhookEvent: vi.fn(),
      createRefund: vi.fn(),
    },
    gateway: new MockGateway(),
    orders: { findById: vi.fn(), updateStatus: vi.fn() },
    events: { publish: vi.fn().mockResolvedValue(undefined) },
  };

  let service: PaymentService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService(deps.payments as never, deps.gateway as never, deps.orders as never, deps.events as never);
  });

  it('验签失败抛 UnauthorizedError', async () => {
    await expect(
      service.handleCallback({
        provider: 'mock',
        providerTransactionId: 'MOCK1',
        merchantOrderId: 'ORD1',
        amount: 101234,
        status: 'SUCCESS',
        signature: 'wrong-signature',
        rawPayload: {},
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('支付流水不存在抛 NotFoundError', async () => {
    deps.payments.findByProviderTransaction.mockResolvedValue(null);
    const gateway = deps.gateway;
    const sig = gateway.sign('ORD1', 'MOCK1', 101234);
    await expect(
      service.handleCallback({
        provider: 'mock',
        providerTransactionId: 'MOCK1',
        merchantOrderId: 'ORD1',
        amount: 101234,
        status: 'SUCCESS',
        signature: sig,
        rawPayload: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('金额不一致抛 ValidationError', async () => {
    deps.payments.findByProviderTransaction.mockResolvedValue(payment);
    const gateway = deps.gateway;
    const sig = gateway.sign('ORD1', 'MOCK1', 9999);
    await expect(
      service.handleCallback({
        provider: 'mock',
        providerTransactionId: 'MOCK1',
        merchantOrderId: 'ORD1',
        amount: 9999,
        status: 'SUCCESS',
        signature: sig,
        rawPayload: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('成功回调：验签→落库→幂等→金额校验→状态流转→联动订单→ACK', async () => {
    deps.payments.findByProviderTransaction.mockResolvedValue(payment);
    deps.payments.findById.mockResolvedValue(payment); // transitionPayment 内部二次查询
    deps.payments.updateStatus.mockResolvedValue({ ...payment, status: 'SUCCESS' });
    const gateway = deps.gateway;
    const sig = gateway.sign('ORD1', 'MOCK1', 101234);

    const result = await service.handleCallback({
      provider: 'mock',
      providerTransactionId: 'MOCK1',
      merchantOrderId: 'ORD1',
      amount: 101234,
      status: 'SUCCESS',
      signature: sig,
      rawPayload: { foo: 'bar' },
    });

    expect(result).toEqual({ ack: 'ok' });
    // 原始报文落库（审计，先于幂等）
    expect(deps.payments.createWebhookEvent).toHaveBeenCalled();
    // 支付状态流转为 SUCCESS
    expect(deps.payments.updateStatus).toHaveBeenCalledWith('p-1', 'SUCCESS');
    // 联动订单 → PAID
    expect(deps.orders.updateStatus).toHaveBeenCalledWith('o-1', 'PAID');
    // 发布 PaymentSucceeded 领域事件（幂等键 = settlement-{orderId}）
    expect(deps.events.publish).toHaveBeenCalledWith(
      'settlement',
      expect.objectContaining({
        name: 'PaymentSucceeded',
        idempotencyKey: 'settlement-o-1',
      }),
    );
  });

  it('幂等：已 SUCCESS 的支付重复回调直接 ACK，不重复流转', async () => {
    deps.payments.findByProviderTransaction.mockResolvedValue({ ...payment, status: 'SUCCESS' });
    const gateway = deps.gateway;
    const sig = gateway.sign('ORD1', 'MOCK1', 101234);

    const result = await service.handleCallback({
      provider: 'mock',
      providerTransactionId: 'MOCK1',
      merchantOrderId: 'ORD1',
      amount: 101234,
      status: 'SUCCESS',
      signature: sig,
      rawPayload: {},
    });

    expect(result).toEqual({ ack: 'ok' });
    // 幂等命中：不重复更新状态、不重复联动订单
    expect(deps.payments.updateStatus).not.toHaveBeenCalled();
    expect(deps.orders.updateStatus).not.toHaveBeenCalled();
  });
});

describe('PaymentService.refund（退款金额校验）', () => {
  const payment = {
    id: 'p-1',
    orderId: 'o-1',
    provider: 'mock' as const,
    providerTransactionId: 'MOCK1',
    merchantOrderId: 'ORD1',
    amount: 10000,
    refundedAmount: 0,
    status: 'SUCCESS' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const deps = {
    payments: {
      findById: vi.fn(),
      findByMerchantOrderId: vi.fn(),
      findByProviderTransaction: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      addRefundedAmount: vi.fn(),
      createWebhookEvent: vi.fn(),
      createRefund: vi.fn(),
    },
    gateway: new MockGateway(),
    orders: { findById: vi.fn(), updateStatus: vi.fn() },
    events: { publish: vi.fn().mockResolvedValue(undefined) },
  };

  let service: PaymentService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService(deps.payments as never, deps.gateway as never, deps.orders as never, deps.events as never);
  });

  it('非 SUCCESS 状态不可退款', async () => {
    deps.payments.findById.mockResolvedValue({ ...payment, status: 'PENDING' });
    await expect(service.refund('p-1', 1000, 'RFN1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('退款金额超过可退金额被拒绝', async () => {
    deps.payments.findById.mockResolvedValue({ ...payment, refundedAmount: 8000 });
    await expect(service.refund('p-1', 3000, 'RFN1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('部分退款：创建退款单并累计退款金额，支付状态保持 SUCCESS', async () => {
    deps.payments.findById.mockResolvedValue(payment);
    deps.payments.createRefund.mockResolvedValue({ id: 'r-1', paymentId: 'p-1', refundNo: 'RFN1', providerRefundId: null, amount: 3000, status: 'CREATED', createdAt: new Date(), updatedAt: new Date() });

    const refund = await service.refund('p-1', 3000, 'RFN1');

    expect(refund.amount).toBe(3000);
    expect(deps.payments.createRefund).toHaveBeenCalled();
    expect(deps.payments.addRefundedAmount).toHaveBeenCalledWith('p-1', 3000);
    // 部分退款（3000 < 10000）不触发 REFUNDED
    expect(deps.payments.updateStatus).not.toHaveBeenCalled();
  });

  it('全额退款：支付状态流转为 REFUNDED', async () => {
    deps.payments.findById.mockResolvedValue(payment);
    deps.payments.createRefund.mockResolvedValue({ id: 'r-1', paymentId: 'p-1', refundNo: 'RFN2', providerRefundId: null, amount: 10000, status: 'CREATED', createdAt: new Date(), updatedAt: new Date() });
    deps.payments.updateStatus.mockResolvedValue({ ...payment, status: 'REFUNDED' });

    await service.refund('p-1', 10000, 'RFN2');

    expect(deps.payments.updateStatus).toHaveBeenCalledWith('p-1', 'REFUNDED');
  });
});

describe('PaymentService.createPayment（下单）', () => {
  const order = {
    id: 'o-1',
    orderNo: 'ORD1',
    billId: null,
    amount: 101234,
    status: 'PENDING_PAYMENT' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const deps = {
    payments: {
      findById: vi.fn(),
      findByMerchantOrderId: vi.fn(),
      findByProviderTransaction: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      addRefundedAmount: vi.fn(),
      createWebhookEvent: vi.fn(),
      createRefund: vi.fn(),
    },
    gateway: new MockGateway(),
    orders: { findById: vi.fn(), updateStatus: vi.fn() },
    events: { publish: vi.fn().mockResolvedValue(undefined) },
  };

  let service: PaymentService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentService(deps.payments as never, deps.gateway as never, deps.orders as never, deps.events as never);
  });

  it('订单不存在抛 NotFoundError', async () => {
    deps.orders.findById.mockResolvedValue(null);
    await expect(service.createPayment('o-1', 'mock', '')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('订单未处于待支付状态抛 ValidationError', async () => {
    deps.orders.findById.mockResolvedValue({ ...order, status: 'CREATED' });
    await expect(service.createPayment('o-1', 'mock', '')).rejects.toBeInstanceOf(ValidationError);
  });

  it('已存在支付流水抛 ConflictError', async () => {
    deps.orders.findById.mockResolvedValue(order);
    deps.payments.findByMerchantOrderId.mockResolvedValue({ id: 'p-1' });
    await expect(service.createPayment('o-1', 'mock', '')).rejects.toBeInstanceOf(ConflictError);
  });

  it('成功创建支付流水（初始 PENDING）', async () => {
    deps.orders.findById.mockResolvedValue(order);
    deps.payments.findByMerchantOrderId.mockResolvedValue(null);
    deps.payments.create.mockResolvedValue({
      id: 'p-1', orderId: 'o-1', provider: 'mock', providerTransactionId: 'MOCK1',
      merchantOrderId: 'ORD1', amount: 101234, refundedAmount: 0, status: 'PENDING',
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await service.createPayment('o-1', 'mock', 'https://x/cb');

    expect(result.status).toBe('PENDING');
    expect(deps.payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'o-1', merchantOrderId: 'ORD1', status: 'PENDING' }),
    );
  });

  it('成功创建支付后入队延迟关单任务（默认 30 分钟）', async () => {
    deps.orders.findById.mockResolvedValue(order);
    deps.payments.findByMerchantOrderId.mockResolvedValue(null);
    deps.payments.create.mockResolvedValue({
      id: 'p-1', orderId: 'o-1', provider: 'mock', providerTransactionId: 'MOCK1',
      merchantOrderId: 'ORD1', amount: 101234, refundedAmount: 0, status: 'PENDING',
      createdAt: new Date(), updatedAt: new Date(),
    });

    await service.createPayment('o-1', 'mock', 'https://x/cb');

    expect(deps.events.publish).toHaveBeenCalledWith(
      'payment',
      expect.objectContaining({
        name: 'PaymentTimeoutClose',
        idempotencyKey: 'payment-close-p-1',
      }),
      expect.objectContaining({ delay: 30 * 60 * 1000 }),
    );
  });

  it('延迟关单任务超时窗口可通过 PAYMENT_TIMEOUT_MS 配置', async () => {
    process.env.PAYMENT_TIMEOUT_MS = '60000';
    try {
      deps.orders.findById.mockResolvedValue(order);
      deps.payments.findByMerchantOrderId.mockResolvedValue(null);
      deps.payments.create.mockResolvedValue({
        id: 'p-2', orderId: 'o-1', provider: 'mock', providerTransactionId: 'MOCK1',
        merchantOrderId: 'ORD1', amount: 101234, refundedAmount: 0, status: 'PENDING',
        createdAt: new Date(), updatedAt: new Date(),
      });

      await service.createPayment('o-1', 'mock', 'https://x/cb');

      expect(deps.events.publish).toHaveBeenCalledWith(
        'payment',
        expect.anything(),
        expect.objectContaining({ delay: 60000 }),
      );
    } finally {
      delete process.env.PAYMENT_TIMEOUT_MS;
    }
  });
});
