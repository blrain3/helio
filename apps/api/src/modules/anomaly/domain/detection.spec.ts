import { describe, it, expect } from 'vitest';
import {
  rollingStats,
  zScore,
  severityFromZScore,
  detectAnomalies,
} from './detection';
import { AnomalyRuleEntity } from './anomaly.entity';

const mkRule = (overrides: Partial<AnomalyRuleEntity>): AnomalyRuleEntity => ({
  id: 'rule-1',
  name: '规则',
  condition: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 },
  severity: 'WARNING',
  enabled: true,
  version: 1,
  createdAt: new Date(),
  ...overrides,
});

describe('rollingStats', () => {
  it('空序列返回 0', () => {
    expect(rollingStats([])).toEqual({ count: 0, mean: 0, stdDev: 0 });
  });

  it('单元素标准差为 0', () => {
    expect(rollingStats([5])).toEqual({ count: 1, mean: 5, stdDev: 0 });
  });

  it('多样本计算均值与样本标准差', () => {
    const s = rollingStats([2, 4, 6]);
    expect(s.mean).toBe(4);
    expect(s.stdDev).toBeCloseTo(2);
  });
});

describe('zScore', () => {
  it('标准差为 0 时返回 0', () => {
    expect(zScore(10, { count: 3, mean: 5, stdDev: 0 })).toBe(0);
  });

  it('正常计算偏离', () => {
    expect(zScore(8, { count: 3, mean: 4, stdDev: 2 })).toBe(2);
  });
});

describe('severityFromZScore', () => {
  it('≥3 为 CRITICAL，≥2 为 WARNING，否则 NORMAL', () => {
    expect(severityFromZScore(3)).toBe('CRITICAL');
    expect(severityFromZScore(2.5)).toBe('WARNING');
    expect(severityFromZScore(1.5)).toBe('NORMAL');
  });
});

describe('detectAnomalies', () => {
  const history = [
    { value: 5, timestamp: new Date('2026-09-02T10:00:00Z') },
    { value: 5.2, timestamp: new Date('2026-09-02T10:30:00Z') },
    { value: 4.8, timestamp: new Date('2026-09-02T11:00:00Z') },
    { value: 5.1, timestamp: new Date('2026-09-02T11:30:00Z') },
  ];

  it('阈值规则命中', () => {
    const rules = [
      mkRule({ condition: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 } }),
    ];
    const hits = detectAnomalies(rules, { value: 0.5, timestamp: new Date('2026-09-02T12:00:00Z') }, history);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.ruleId).toBe('rule-1');
    expect(hits[0]!.actualValue).toBe(0.5);
    expect(hits[0]!.baselineValue).toBe(1);
  });

  it('阈值规则未命中', () => {
    const rules = [
      mkRule({ condition: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 } }),
    ];
    const hits = detectAnomalies(rules, { value: 5, timestamp: new Date('2026-09-02T12:00:00Z') }, history);
    expect(hits).toHaveLength(0);
  });

  it('突降规则命中（相对窗口基线下降超比例）', () => {
    const rules = [
      mkRule({
        id: 'drop-rule',
        condition: { type: 'drop', metric: 'generationKwh', windowMinutes: 60, dropRatio: 0.5 },
      }),
    ];
    // 60 分钟窗口（12:00 往前）内基线为 [4.8, 5.1] → 均值约 4.95；当前 2 → 降 60% > 50%。
    const hits = detectAnomalies(rules, { value: 2, timestamp: new Date('2026-09-02T12:00:00Z') }, history);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.ruleId).toBe('drop-rule');
    expect(hits[0]!.baselineValue).toBeCloseTo(4.95, 1);
  });

  it('突降规则未命中（下降不足比例，且不触发 z-score 兜底）', () => {
    const rules = [
      mkRule({
        id: 'drop-rule',
        condition: { type: 'drop', metric: 'generationKwh', windowMinutes: 60, dropRatio: 0.9 },
      }),
    ];
    // 下降比例 0.9，当前 4.9 相对基线 4.95 仅降约 1% → 不命中；z-score 也低于阈值。
    const hits = detectAnomalies(rules, { value: 4.9, timestamp: new Date('2026-09-02T12:00:00Z') }, history);
    expect(hits).toHaveLength(0);
  });

  it('z-score 内置检测命中显著偏离', () => {
    // 历史均值约 5、标准差约 0.17；当前 20 → z 极高。
    const hits = detectAnomalies([], { value: 20, timestamp: new Date('2026-09-02T12:00:00Z') }, history);
    const zHits = hits.filter((h) => h.ruleId === '__zscore__');
    expect(zHits.length).toBe(1);
    expect(zHits[0]!.severity).toBe('CRITICAL');
  });

  it('历史不足时不触发 z-score', () => {
    const hits = detectAnomalies([], { value: 20, timestamp: new Date('2026-09-02T12:00:00Z') }, [history[0]!]);
    expect(hits.filter((h) => h.ruleId === '__zscore__')).toHaveLength(0);
  });
});
