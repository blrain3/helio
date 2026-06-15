import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from './auth/domain/errors';
import { PlantService } from './energy/application/plant.service';
import { DeviceService } from './energy/application/device.service';
import { BillingService } from './billing/application/billing.service';
import { OrderService } from './order/application/order.service';
import { PaymentService } from './payment/application/payment.service';
import { ReconciliationService } from './payment/application/reconciliation.service';
import { UserService } from './user/application/user.service';
import { AuthUser } from './auth/domain/user.entity';

const intruder: AuthUser = { sub: 'user-b', email: 'b@example.com', role: 'USER' };
const ownerPlant = { id: 'plant-a', userId: 'user-a' };
const ownerBill = { id: 'bill-a', plantId: 'plant-a', totalAmount: 100, status: 'ISSUED' };
const ownerOrder = {
  id: 'order-a',
  billId: 'bill-a',
  orderNo: 'ORD-A',
  amount: 100,
  status: 'PENDING_PAYMENT',
};
const ownerPayment = {
  id: 'payment-a',
  orderId: 'order-a',
  provider: 'mock',
  providerTransactionId: 'tx-a',
  merchantOrderId: 'ORD-A',
  amount: 100,
  refundedAmount: 0,
  status: 'PENDING',
};

const callWithUser = <T>(
  method: unknown,
  ...args: unknown[]
): Promise<T> => (method as (...values: unknown[]) => Promise<T>)(...args);

function ownerOrderService(): OrderService {
  return new OrderService(
    { findById: vi.fn().mockResolvedValue(ownerOrder) } as never,
    { findById: vi.fn().mockResolvedValue(ownerBill) } as never,
    { findById: vi.fn().mockResolvedValue(ownerPlant) } as never,
  );
}

describe('resource authorization', () => {
  it('rejects a different user reading a plant', async () => {
    const service = new PlantService({ findById: vi.fn().mockResolvedValue(ownerPlant) } as never);

    await expect(callWithUser(service.findById.bind(service), 'plant-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a different user reading a device', async () => {
    const service = new DeviceService(
      { findById: vi.fn().mockResolvedValue({ id: 'device-a', plantId: 'plant-a' }) } as never,
      { findById: vi.fn().mockResolvedValue(ownerPlant) } as never,
    );

    await expect(callWithUser(service.findById.bind(service), 'device-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a different user reading a bill', async () => {
    const service = new BillingService(
      { findById: vi.fn().mockResolvedValue(ownerBill) } as never,
      {} as never,
      { findById: vi.fn().mockResolvedValue(ownerPlant) } as never,
      {} as never,
    );

    await expect(callWithUser(service.findById.bind(service), 'bill-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a different user reading an order', async () => {
    const service = ownerOrderService();

    await expect(callWithUser(service.findById.bind(service), 'order-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a different user reading a payment', async () => {
    const service = new PaymentService(
      { findById: vi.fn().mockResolvedValue(ownerPayment) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      ownerOrderService(),
    );

    await expect(callWithUser(service.findById.bind(service), 'payment-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('rejects a different user closing or refunding a payment before a gateway call', async () => {
    const gateway = { closePayment: vi.fn(), refundPayment: vi.fn() };
    const closeService = new PaymentService(
      {
        findById: vi.fn().mockResolvedValue(ownerPayment),
        updateStatus: vi.fn().mockResolvedValue({ ...ownerPayment, status: 'CLOSED' }),
      } as never,
      gateway as never,
      {} as never,
      {} as never,
      { findPendingByPaymentId: vi.fn() } as never,
      ownerOrderService(),
    );
    const refundService = new PaymentService(
      {
        findById: vi.fn().mockResolvedValue({ ...ownerPayment, status: 'SUCCESS' }),
        createRefund: vi.fn().mockResolvedValue({ id: 'refund-a' }),
        addRefundedAmount: vi.fn(),
      } as never,
      gateway as never,
      {} as never,
      {} as never,
      { findPendingByPaymentId: vi.fn().mockResolvedValue(null) } as never,
      ownerOrderService(),
    );

    await expect(callWithUser(closeService.closePayment.bind(closeService), 'payment-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      callWithUser(refundService.refund.bind(refundService), 'payment-a', 10, 'refund-a', intruder),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(gateway.closePayment).not.toHaveBeenCalled();
    expect(gateway.refundPayment).not.toHaveBeenCalled();
  });

  it('rejects a different user resolving a linked reconciliation difference', async () => {
    const Service = ReconciliationService as unknown as new (...args: unknown[]) => {
      resolveDiff: (...args: unknown[]) => Promise<unknown>;
    };
    const service = new Service(
      {} as never,
      {
        findById: vi.fn().mockResolvedValue({ id: 'diff-a', paymentId: 'payment-a', status: 'PENDING' }),
        resolve: vi.fn(),
      } as never,
      {} as never,
      { findById: vi.fn().mockResolvedValue(ownerPayment) } as never,
      ownerOrderService(),
    );

    await expect(service.resolveDiff('diff-a', intruder)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows only the account owner or an administrator to read a user', async () => {
    const findById = vi.fn().mockResolvedValue({ id: 'user-a', email: 'a@example.com' });
    const service = new UserService({ findById } as never);

    await expect(callWithUser(service.findById.bind(service), 'user-a', intruder)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      callWithUser(service.findById.bind(service), 'user-a', {
        ...intruder,
        role: 'ADMIN',
      }),
    ).resolves.toEqual({ id: 'user-a', email: 'a@example.com' });
  });
});
