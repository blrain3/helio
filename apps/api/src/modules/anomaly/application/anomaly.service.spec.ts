import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnomalyService } from './anomaly.service';
import { NotFoundError, ForbiddenError } from '../../auth/domain/errors';

describe('AnomalyService', () => {
  const deps = {
    anomalies: {
      listRules: vi.fn(),
      findRuleById: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      removeRule: vi.fn(),
      createEvent: vi.fn(),
      listEvents: vi.fn(),
    },
    records: { findByPlantId: vi.fn() },
    plants: { findById: vi.fn() },
  };
  let service: AnomalyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AnomalyService(
      deps.anomalies as never,
      deps.records as never,
      deps.plants as never,
    );
  });

  it('创建规则', async () => {
    const rule = {
      id: 'r1', name: 'x',
      condition: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 },
      severity: 'WARNING', enabled: true, version: 1, createdAt: new Date(),
    };
    deps.anomalies.createRule.mockResolvedValue(rule);
    const result = await service.createRule({
      name: 'x',
      condition: rule.condition as never,
      severity: 'WARNING',
    });
    expect(result.id).toBe('r1');
  });

  it('更新不存在的规则抛 NotFoundError', async () => {
    deps.anomalies.findRuleById.mockResolvedValue(null);
    await expect(service.updateRule('nope', { name: 'y' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('删除不存在的规则抛 NotFoundError', async () => {
    deps.anomalies.findRuleById.mockResolvedValue(null);
    await expect(service.removeRule('nope')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('检测：无启用规则时直接返回空', async () => {
    deps.anomalies.listRules.mockResolvedValue([]);
    const result = await service.detect('plant-1', { value: 5, timestamp: new Date() });
    expect(result).toEqual([]);
  });

  it('检测：命中规则后落库 AnomalyEvent', async () => {
    const rule = {
      id: 'r1', name: '低发电', 
      condition: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 },
      severity: 'WARNING', enabled: true, version: 1, createdAt: new Date(),
    };
    deps.anomalies.listRules.mockResolvedValue([rule]);
    deps.plants.findById.mockResolvedValue({ id: 'plant-1', userId: 'user-1' });
    deps.records.findByPlantId.mockResolvedValue([
      { id: 1, deviceId: 'd1', plantId: 'plant-1', generationKwh: 5, timestamp: new Date() },
    ]);
    deps.anomalies.createEvent.mockImplementation(
      async (d: Record<string, unknown>) => ({
        id: 'e1',
        ...d,
        detectedAt: new Date(),
        createdAt: new Date(),
      }),
    );

    const result = await service.detect(
      'plant-1',
      { value: 0.5, timestamp: new Date('2026-09-02T12:00:00Z') },
      24,
      'user-1',
    );

    expect(deps.anomalies.createEvent).toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.ruleId).toBe('r1');
  });

  it('检测：传入 userId 时校验电站归属', async () => {
    deps.plants.findById.mockResolvedValue({ id: 'plant-1', userId: 'other' });
    await expect(
      service.detect('plant-1', { value: 5, timestamp: new Date() }, 24, 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('查询事件：非本人电站抛 ForbiddenError', async () => {
    deps.plants.findById.mockResolvedValue({ id: 'plant-1', userId: 'other' });
    await expect(
      service.listEvents('plant-1', 'user-1', new Date(), new Date()),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
