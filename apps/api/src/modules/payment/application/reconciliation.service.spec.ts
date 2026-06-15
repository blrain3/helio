import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationService } from './reconciliation.service';
import { NotFoundError, ValidationError } from '../../auth/domain/errors';
import { canTransitionReconciliationDiff } from '../domain/payment.entity';

const owner = { sub: 'user-1', email: 'owner@example.com', role: 'USER' as const };

describe('Reconciliation diff state machine', () => {
  it('合法流转：PENDING → RESOLVED', () => {
    expect(canTransitionReconciliationDiff('PENDING', 'RESOLVED')).toBe(true);
  });

  it('非法流转被拒绝', () => {
    expect(canTransitionReconciliationDiff('RESOLVED', 'RESOLVED')).toBe(false);
    expect(canTransitionReconciliationDiff('RESOLVED', 'PENDING')).toBe(false);
  });
});

describe('ReconciliationService.resolveDiff（差异处置：解锁冻结）', () => {
  const deps = {
    prisma: {},
    diffs: {
      findById: vi.fn(),
      resolve: vi.fn(),
      create: vi.fn(),
      findPendingByPaymentId: vi.fn(),
    },
    gateway: { downloadBill: vi.fn() },
    payments: { findById: vi.fn() },
    orders: { assertOwnedByUser: vi.fn() },
  };

  let service: ReconciliationService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReconciliationService(
      deps.prisma as never,
      deps.diffs as never,
      deps.gateway as never,
      deps.payments as never,
      deps.orders as never,
    );
  });

  it('差异不存在抛 NotFoundError', async () => {
    deps.diffs.findById.mockResolvedValue(null);
    await expect(service.resolveDiff('missing', owner)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('PENDING → RESOLVED，调用仓储解锁', async () => {
    deps.diffs.findById.mockResolvedValue({ id: 'd-1', paymentId: 'payment-1', status: 'PENDING' });
    deps.payments.findById.mockResolvedValue({ orderId: 'o-1' });
    deps.diffs.resolve.mockResolvedValue(true);

    const result = await service.resolveDiff('d-1', owner);

    expect(result).toEqual({ id: 'd-1', status: 'RESOLVED' });
    expect(deps.diffs.resolve).toHaveBeenCalledWith('d-1');
  });

  it('已 RESOLVED 幂等返回，不重复流转', async () => {
    deps.diffs.findById.mockResolvedValue({ id: 'd-1', paymentId: 'payment-1', status: 'RESOLVED' });
    deps.payments.findById.mockResolvedValue({ orderId: 'o-1' });

    const result = await service.resolveDiff('d-1', owner);

    expect(result).toEqual({ id: 'd-1', status: 'RESOLVED' });
    expect(deps.diffs.resolve).not.toHaveBeenCalled();
  });
});

describe('ReconciliationService.reconcile（差异检测 + 冻结关联）', () => {
  const localPayments = [
    { id: 'p-1', merchantOrderId: 'ORD1', amount: 10000, status: 'SUCCESS', createdAt: new Date('2026-09-01T10:00:00Z') },
    { id: 'p-2', merchantOrderId: 'ORD2', amount: 20000, status: 'SUCCESS', createdAt: new Date('2026-09-01T11:00:00Z') },
    { id: 'p-3', merchantOrderId: 'ORD3', amount: 30000, status: 'SUCCESS', createdAt: new Date('2026-09-01T12:00:00Z') },
  ];

  const deps = {
    prisma: { payment: { findMany: vi.fn() } },
    diffs: { create: vi.fn().mockResolvedValue(undefined) },
    gateway: { downloadBill: vi.fn() },
  };

  const makeService = () =>
    new ReconciliationService(deps.prisma as never, deps.diffs as never, deps.gateway as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('检测三类差异并统一落库 PENDING（冻结），paymentId 关联正确', async () => {
    deps.prisma.payment.findMany.mockResolvedValue(localPayments);
    // 合成对账单：ORD1 金额不一致（DISCREPANCY）；ORD2 一致；ORD3 缺失（MISSING_IN_STATEMENT）；
    //             ORD4 仅存在于对账单（MISSING_IN_LOCAL）。
    deps.gateway.downloadBill.mockResolvedValue([
      { merchantOrderId: 'ORD1', amount: 9999, status: 'SUCCESS' },
      { merchantOrderId: 'ORD2', amount: 20000, status: 'SUCCESS' },
      { merchantOrderId: 'ORD4', amount: 40000, status: 'SUCCESS' },
    ]);

    const result = await makeService().reconcile(new Date('2026-09-01'));

    expect(result.total).toBe(3);
    expect(result.matched).toBe(1); // 仅 ORD2 一致
    expect(result.discrepancies).toHaveLength(3);

    const byResult = (r: string) => result.discrepancies.filter((d) => d.result === r);
    expect(byResult('DISCREPANCY')).toHaveLength(1);
    expect(byResult('MISSING_IN_STATEMENT')).toHaveLength(1);
    expect(byResult('MISSING_IN_LOCAL')).toHaveLength(1);

    // 关联 paymentId：DISCREPANCY / MISSING_IN_STATEMENT 关联本地流水，MISSING_IN_LOCAL 为 null。
    expect(byResult('DISCREPANCY')[0]!.paymentId).toBe('p-1');
    expect(byResult('MISSING_IN_STATEMENT')[0]!.paymentId).toBe('p-3');
    expect(byResult('MISSING_IN_LOCAL')[0]!.paymentId).toBeNull();

    // 全部以 PENDING 落库（冻结退款），关联 paymentId 正确。
    expect(deps.diffs.create).toHaveBeenCalledTimes(3);
    expect(deps.diffs.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', paymentId: 'p-1' }),
    );
    expect(deps.diffs.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PENDING', paymentId: null }),
    );
  });
});

describe('ReconciliationService 异常场景（对账单下载与解析）', () => {
  const deps = {
    prisma: { payment: { findMany: vi.fn() } },
    diffs: { create: vi.fn() },
    gateway: { downloadBill: vi.fn() },
  };

  const makeService = () =>
    new ReconciliationService(deps.prisma as never, deps.diffs as never, deps.gateway as never);

  beforeEach(() => {
    vi.clearAllMocks();
    deps.prisma.payment.findMany.mockResolvedValue([]);
  });

  it('下载失败：gateway.downloadBill 抛错上抛（供上层重试）', async () => {
    deps.gateway.downloadBill.mockRejectedValue(new Error('channel download failed'));
    await expect(makeService().reconcile(new Date('2026-09-01'))).rejects.toThrow(
      'channel download failed',
    );
  });

  it('解析失败：对账单行金额非正整数分 → ValidationError', async () => {
    deps.gateway.downloadBill.mockResolvedValue([
      { merchantOrderId: 'ORD1', amount: '100', status: 'SUCCESS' },
    ]);
    await expect(makeService().reconcile(new Date('2026-09-01'))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('格式不符：缺少 merchantOrderId → ValidationError', async () => {
    deps.gateway.downloadBill.mockResolvedValue([{ amount: 100, status: 'SUCCESS' }]);
    await expect(makeService().reconcile(new Date('2026-09-01'))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('格式不符：对账单行为非对象 → ValidationError', async () => {
    deps.gateway.downloadBill.mockResolvedValue([null]);
    await expect(makeService().reconcile(new Date('2026-09-01'))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('对账金额不匹配：DISCREPANCY 落库并冻结关联支付', async () => {
    deps.prisma.payment.findMany.mockResolvedValue([
      { id: 'p-1', merchantOrderId: 'ORD1', amount: 10000, status: 'SUCCESS', createdAt: new Date('2026-09-01T10:00:00Z') },
    ]);
    deps.gateway.downloadBill.mockResolvedValue([
      { merchantOrderId: 'ORD1', amount: 9999, status: 'SUCCESS' },
    ]);

    const result = await makeService().reconcile(new Date('2026-09-01'));

    expect(result.matched).toBe(0);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]!.result).toBe('DISCREPANCY');
    expect(deps.diffs.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISCREPANCY', status: 'PENDING', paymentId: 'p-1' }),
    );
  });
});
