import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationService } from './reconciliation.service';
import { NotFoundError } from '../../auth/domain/errors';
import { canTransitionReconciliationDiff } from '../domain/payment.entity';

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
  };

  let service: ReconciliationService;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReconciliationService(deps.prisma as never, deps.diffs as never);
  });

  it('差异不存在抛 NotFoundError', async () => {
    deps.diffs.findById.mockResolvedValue(null);
    await expect(service.resolveDiff('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('PENDING → RESOLVED，调用仓储解锁', async () => {
    deps.diffs.findById.mockResolvedValue({ id: 'd-1', status: 'PENDING' });
    deps.diffs.resolve.mockResolvedValue(true);

    const result = await service.resolveDiff('d-1');

    expect(result).toEqual({ id: 'd-1', status: 'RESOLVED' });
    expect(deps.diffs.resolve).toHaveBeenCalledWith('d-1');
  });

  it('已 RESOLVED 幂等返回，不重复流转', async () => {
    deps.diffs.findById.mockResolvedValue({ id: 'd-1', status: 'RESOLVED' });

    const result = await service.resolveDiff('d-1');

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
    diffs: {
      findById: vi.fn(),
      resolve: vi.fn(),
      create: vi.fn().mockResolvedValue(undefined),
      findPendingByPaymentId: vi.fn(),
    },
  };

  // 通过子类注入合成对账单，覆盖 Mock 默认「与本地一致」。
  // 合成对账单：ORD1 金额不一致（DISCREPANCY）；ORD2 一致；ORD3 缺失（MISSING_IN_STATEMENT）；
  //             ORD4 仅存在于对账单（MISSING_IN_LOCAL）。
  class TestableReconciliationService extends ReconciliationService {
    protected override async generateStatement(
      _start: Date,
      _end: Date,
    ): Promise<Array<{ merchantOrderId: string; amount: number; status: string }>> {
      return [
        { merchantOrderId: 'ORD1', amount: 9999, status: 'SUCCESS' },
        { merchantOrderId: 'ORD2', amount: 20000, status: 'SUCCESS' },
        { merchantOrderId: 'ORD4', amount: 40000, status: 'SUCCESS' },
      ];
    }
  }

  it('检测三类差异并统一落库 PENDING（冻结），paymentId 关联正确', async () => {
    deps.prisma.payment.findMany.mockResolvedValue(localPayments);
    const service = new TestableReconciliationService(deps.prisma as never, deps.diffs as never);

    const result = await service.reconcile(new Date('2026-09-01'));

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
