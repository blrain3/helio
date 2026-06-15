import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../auth/domain/errors';
import { MockGateway } from '../infrastructure/mock.gateway';
import { MockPaymentService } from './mock-payment.service';

const payment = {
  id: 'payment-1',
  orderId: 'order-1',
  provider: 'mock' as const,
  providerTransactionId: 'MOCK-1',
  merchantOrderId: 'ORD-1',
  amount: 1250,
  refundedAmount: 0,
  status: 'PENDING' as const,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

describe('MockPaymentService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPaymentProvider = process.env.PAYMENT_PROVIDER;
  const payments = {
    findById: vi.fn(),
    handleCallback: vi.fn(),
  };
  const gateway = new MockGateway({} as never);
  let service: MockPaymentService;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_PROVIDER = 'mock';
    vi.clearAllMocks();
    service = new MockPaymentService(payments as never, gateway);
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalPaymentProvider === undefined) {
      delete process.env.PAYMENT_PROVIDER;
    } else {
      process.env.PAYMENT_PROVIDER = originalPaymentProvider;
    }
  });

  it('creates a signed SUCCESS callback from persisted payment fields and processes it', async () => {
    payments.findById.mockResolvedValue(payment);
    payments.handleCallback.mockResolvedValue({ ack: 'ok' });

    await expect(service.complete('payment-1')).resolves.toEqual({ ack: 'ok' });

    const callback = payments.handleCallback.mock.calls[0]?.[0];
    expect(callback).toMatchObject({
      provider: 'mock',
      providerTransactionId: 'MOCK-1',
      merchantOrderId: 'ORD-1',
      amount: 1250,
      status: 'SUCCESS',
    });
    expect(gateway.verifyCallback(callback)).toBe(true);
  });

  it('rejects the orchestrator in production before processing browser-requested payment IDs', async () => {
    process.env.NODE_ENV = 'production';

    await expect(service.complete('payment-1')).rejects.toBeInstanceOf(ForbiddenError);

    expect(payments.findById).not.toHaveBeenCalled();
    expect(payments.handleCallback).not.toHaveBeenCalled();
  });

  it('rejects the orchestrator when Mock is not the active payment provider', async () => {
    process.env.PAYMENT_PROVIDER = 'wechat';

    await expect(service.complete('payment-1')).rejects.toBeInstanceOf(ForbiddenError);

    expect(payments.findById).not.toHaveBeenCalled();
    expect(payments.handleCallback).not.toHaveBeenCalled();
  });
});
