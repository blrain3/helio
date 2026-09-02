import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingService } from './billing.service';
import { OrderService } from '../../order/application/order.service';
import { AmountCalculator } from '../domain/amount-calculator';
import { canTransition } from '../../order/domain/order.entity';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../auth/domain/errors';

describe('AmountCalculator', () => {
  const calc = new AmountCalculator();

  it('金额计算：quantity × unit_price，四舍五入到分', () => {
    // 1234.56 kWh × 82 分 = 101233.92 → round = 101234 分
    expect(calc.calculate(1234.56, 82).totalAmount).toBe(101234);
  });

  it('金额计算：整数运算精确（无浮点误差）', () => {
    expect(calc.calculate(100, 65).totalAmount).toBe(6500);
  });

  it('金额计算：零发电量 → 零金额', () => {
    expect(calc.calculate(0, 82).totalAmount).toBe(0);
  });
});

describe('Order state machine', () => {
  it('合法流转', () => {
    expect(canTransition('CREATED', 'PENDING_PAYMENT')).toBe(true);
    expect(canTransition('PENDING_PAYMENT', 'PAID')).toBe(true);
    expect(canTransition('PAID', 'COMPLETED')).toBe(true);
    expect(canTransition('PENDING_PAYMENT', 'CLOSED')).toBe(true);
  });

  it('非法流转被拒绝', () => {
    expect(canTransition('CREATED', 'PAID')).toBe(false);
    expect(canTransition('PAID', 'PENDING_PAYMENT')).toBe(false);
    expect(canTransition('COMPLETED', 'CLOSED')).toBe(false);
  });
});

describe('BillingService', () => {
  const plant = {
    id: 'plant-1', name: 'p', capacity: 1, location: null,
    userId: 'user-1', createdAt: new Date(), updatedAt: new Date(),
  };
  const tariff = {
    id: 't-1', unitPrice: 82, currency: 'CNY', billingUnit: 'kWh',
    effectiveAt: new Date('2026-01-01'), createdAt: new Date(),
  };
  const deps = {
    bills: { findById: vi.fn(), findByPlantId: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
    tariffs: { findEffectiveAt: vi.fn() },
    plants: { findById: vi.fn() },
    calculator: new AmountCalculator(),
  };
  let service: BillingService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillingService(
      deps.bills as never, deps.tariffs as never, deps.plants as never, deps.calculator,
    );
  });

  it('生成账单：按生效费率计算金额并持久化', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.tariffs.findEffectiveAt.mockResolvedValue(tariff);
    deps.bills.create.mockResolvedValue({ id: 'b-1', plantId: 'plant-1', consumedKwh: 1234.56, unitPrice: 82, totalAmount: 101234, periodStart: new Date(), periodEnd: new Date(), status: 'PENDING', createdAt: new Date() });

    const bill = await service.generate(
      { plantId: 'plant-1', consumedKwh: 1234.56, periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-31') },
      'user-1',
    );

    expect(bill.totalAmount).toBe(101234);
    expect(deps.bills.create).toHaveBeenCalledWith(
      expect.objectContaining({ unitPrice: 82, totalAmount: 101234 }),
    );
  });

  it('生成账单：无生效费率抛 NotFoundError', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    deps.tariffs.findEffectiveAt.mockResolvedValue(null);
    await expect(
      service.generate({ plantId: 'plant-1', consumedKwh: 10, periodStart: new Date(), periodEnd: new Date(Date.now()+1000) }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('生成账单：越权抛 ForbiddenError', async () => {
    deps.plants.findById.mockResolvedValue({ ...plant, userId: 'other' });
    await expect(
      service.generate({ plantId: 'plant-1', consumedKwh: 10, periodStart: new Date(), periodEnd: new Date(Date.now()+1000) }, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('生成账单：周期非法抛 ValidationError', async () => {
    deps.plants.findById.mockResolvedValue(plant);
    await expect(
      service.generate({ plantId: 'plant-1', consumedKwh: 10, periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-08-01') }, 'user-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('OrderService', () => {
  const order = {
    id: 'o-1', orderNo: 'ORD1', billId: 'b-1', amount: 101234,
    status: 'CREATED' as const, createdAt: new Date(), updatedAt: new Date(),
  };
  const bill = {
    id: 'b-1', plantId: 'plant-1', consumedKwh: 1234.56, unitPrice: 82,
    totalAmount: 101234, periodStart: new Date(), periodEnd: new Date(),
    status: 'ISSUED' as const, createdAt: new Date(),
  };
  const deps = {
    orders: { findById: vi.fn(), findByOrderNo: vi.fn(), create: vi.fn(), updateStatus: vi.fn() },
    bills: { findById: vi.fn(), updateStatus: vi.fn() },
    plants: { findById: vi.fn() },
  };
  let service: OrderService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderService(deps.orders as never, deps.bills as never, deps.plants as never);
  });

  it('创建订单：金额不一致抛 ValidationError', async () => {
    deps.bills.findById.mockResolvedValue(bill);
    deps.plants.findById.mockResolvedValue({ id: 'plant-1', name: 'p', capacity: 1, location: null, userId: 'user-1', createdAt: new Date(), updatedAt: new Date() });
    await expect(
      service.create('b-1', 999, 'user-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('提交支付：CREATED → PENDING_PAYMENT', async () => {
    deps.orders.findById.mockResolvedValue(order);
    deps.bills.findById.mockResolvedValue(bill);
    deps.plants.findById.mockResolvedValue({ id: 'plant-1', name: 'p', capacity: 1, location: null, userId: 'user-1', createdAt: new Date(), updatedAt: new Date() });
    deps.orders.updateStatus.mockResolvedValue({ ...order, status: 'PENDING_PAYMENT' });
    const result = await service.submitPayment('o-1', 'user-1');
    expect(result.status).toBe('PENDING_PAYMENT');
  });

  it('非法流转：CREATED 直接到 PAID 被拒绝', async () => {
    deps.orders.findById.mockResolvedValue(order);
    await expect(
      service.confirmPaid('o-1'),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('支付成功：PENDING_PAYMENT → PAID 并联动账单', async () => {
    deps.orders.findById.mockResolvedValue({ ...order, status: 'PENDING_PAYMENT' });
    deps.orders.updateStatus.mockResolvedValue({ ...order, status: 'PAID' });
    const result = await service.confirmPaid('o-1');
    expect(result.status).toBe('PAID');
    expect(deps.bills.updateStatus).toHaveBeenCalledWith('b-1', 'PAID');
  });
});
