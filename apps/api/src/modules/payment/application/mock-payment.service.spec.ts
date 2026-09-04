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

const owner = {
  sub: 'user-1',
  email: 'owner@helio.dev',
  role: 'USER' as const,
};

describe('MockPaymentService', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPaymentProvider = process.env.PAYMENT_PROVIDER;
  const originalMockPaymentDemoEnabled = process.env.MOCK_PAYMENT_DEMO_ENABLED;
  const payments = {
    findById: vi.fn(),
    handleCallback: vi.fn(),
  };
  const orders = {
    assertOwnedByUser: vi.fn(),
  };
  const gateway = new MockGateway({} as never);
  let service: MockPaymentService;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.MOCK_PAYMENT_DEMO_ENABLED = 'true';
    vi.restoreAllMocks();
    payments.findById.mockReset();
    payments.handleCallback.mockReset();
    orders.assertOwnedByUser.mockReset();
    service = new MockPaymentService(payments as never, gateway, orders as never);
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
    if (originalMockPaymentDemoEnabled === undefined) {
      delete process.env.MOCK_PAYMENT_DEMO_ENABLED;
    } else {
      process.env.MOCK_PAYMENT_DEMO_ENABLED = originalMockPaymentDemoEnabled;
    }
  });

  it('creates a signed SUCCESS callback from persisted payment fields and processes it', async () => {
    payments.findById.mockResolvedValue(payment);
    payments.handleCallback.mockResolvedValue({ ack: 'ok' });

    await expect(service.complete('payment-1', owner)).resolves.toEqual({ ack: 'ok' });

    const callback = payments.handleCallback.mock.calls[0]?.[0];
    expect(callback).toMatchObject({
      provider: 'mock',
      providerTransactionId: 'MOCK-1',
      merchantOrderId: 'ORD-1',
      amount: 1250,
      status: 'SUCCESS',
    });
    expect(gateway.verifyCallback(callback)).toBe(true);
    expect(orders.assertOwnedByUser).toHaveBeenCalledWith('order-1', 'user-1');
  });

  it('rejects a non-owner before constructing or processing a Mock callback', async () => {
    payments.findById.mockResolvedValue(payment);
    orders.assertOwnedByUser.mockRejectedValue(new ForbiddenError('无权操作该订单'));
    const createSuccessCallback = vi.spyOn(gateway, 'createSuccessCallback');

    await expect(
      (
        service.complete as unknown as (
          paymentId: string,
          user: typeof owner,
        ) => Promise<{ ack: string }>
      )('payment-1', { ...owner, sub: 'other-user' }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(orders.assertOwnedByUser).toHaveBeenCalledWith('order-1', 'other-user');
    expect(createSuccessCallback).not.toHaveBeenCalled();
    expect(payments.handleCallback).not.toHaveBeenCalled();
  });

  it('rejects the orchestrator in production before processing browser-requested payment IDs', async () => {
    process.env.NODE_ENV = 'production';

    await expect(service.complete('payment-1', owner)).rejects.toBeInstanceOf(ForbiddenError);

    expect(payments.findById).not.toHaveBeenCalled();
    expect(payments.handleCallback).not.toHaveBeenCalled();
  });

  it('rejects the orchestrator when Mock is not the active payment provider', async () => {
    process.env.PAYMENT_PROVIDER = 'wechat';

    await expect(service.complete('payment-1', owner)).rejects.toBeInstanceOf(ForbiddenError);

    expect(payments.findById).not.toHaveBeenCalled();
    expect(payments.handleCallback).not.toHaveBeenCalled();
  });

  it.each([
    ['the demo flag is absent in development', 'development', 'mock', undefined],
    ['the demo flag is absent when NODE_ENV is unset', undefined, 'mock', undefined],
    ['the demo flag is absent in staging', 'staging', 'mock', undefined],
    ['the demo flag is false', 'development', 'mock', 'false'],
  ])(
    'rejects before payment lookup when %s',
    async (_name, nodeEnv, paymentProvider, demoEnabled) => {
      setEnv('NODE_ENV', nodeEnv);
      setEnv('PAYMENT_PROVIDER', paymentProvider);
      setEnv('MOCK_PAYMENT_DEMO_ENABLED', demoEnabled);
      payments.findById.mockResolvedValue(payment);
      orders.assertOwnedByUser.mockResolvedValue(undefined);
      payments.handleCallback.mockResolvedValue({ ack: 'ok' });

      await expect(service.complete('payment-1', owner)).rejects.toBeInstanceOf(ForbiddenError);

      expect(payments.findById).not.toHaveBeenCalled();
      expect(payments.handleCallback).not.toHaveBeenCalled();
    },
  );
});

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
