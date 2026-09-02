/**
 * 异常检测引擎（纯函数，无框架依赖）。
 *
 * 三条检测通道：
 * 1. 阈值规则：单点观测值与配置阈值的比较（规则引擎）；
 * 2. 突降规则：当前观测相对历史窗口基线的下降比例（滚动统计）；
 * 3. z-score：观测值相对历史窗口均值/标准差的偏离（内置检测器）。
 *
 * 引擎只做「计算与判定」，不做任何持久化，便于单元测试与复用。
 */
import {
  AnomalyRuleEntity,
  DetectionHit,
  RuleCondition,
} from './anomaly.entity';

/** 历史观测点（用于滚动统计与 z-score 基线）。 */
export interface Observation {
  /** 观测值（kWh）。 */
  value: number;
  /** 观测时间。 */
  timestamp: Date;
}

/** 滚动统计结果。 */
export interface RollingStats {
  count: number;
  mean: number;
  stdDev: number;
}

/**
 * 计算滚动统计（均值与样本标准差）。
 * 样本量 < 2 时标准差视为 0（不足以判断离散度）。
 */
export function rollingStats(values: number[]): RollingStats {
  const count = values.length;
  if (count === 0) {
    return { count: 0, mean: 0, stdDev: 0 };
  }
  const mean = values.reduce((a, b) => a + b, 0) / count;
  if (count < 2) {
    return { count, mean, stdDev: 0 };
  }
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (count - 1);
  return { count, mean, stdDev: Math.sqrt(variance) };
}

/**
 * 计算 z-score：(value - mean) / stdDev。
 * stdDev 为 0 时返回 0（无偏离）。
 */
export function zScore(value: number, stats: RollingStats): number {
  if (stats.stdDev === 0) {
    return 0;
  }
  return (value - stats.mean) / stats.stdDev;
}

/**
 * 评估阈值规则条件。
 * @returns 命中返回 true，未命中 false
 */
function evaluateThreshold(condition: RuleCondition, value: number): boolean {
  if (condition.type !== 'threshold') {
    return false;
  }
  const { operator, threshold } = condition;
  switch (operator) {
    case 'GT':
      return value > threshold;
    case 'LT':
      return value < threshold;
    case 'GTE':
      return value >= threshold;
    case 'LTE':
      return value <= threshold;
    default:
      return false;
  }
}

/** 将 z-score 绝对值映射为严重级别。 */
export function severityFromZScore(absScore: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (absScore >= 3) {
    return 'CRITICAL';
  }
  if (absScore >= 2) {
    return 'WARNING';
  }
  return 'NORMAL';
}

/**
 * 检测引擎：给定规则集合、当前观测点与历史窗口，产出命中的告警。
 *
 * @param rules 启用的检测规则
 * @param current 当前观测点
 * @param history 历史观测窗口（滚动统计基线，按时间升序）
 * @param zScoreThreshold 内置 z-score 检测的告警阈值（默认 3，即 3σ）
 */
export function detectAnomalies(
  rules: AnomalyRuleEntity[],
  current: Observation,
  history: Observation[],
  zScoreThreshold = 3,
): DetectionHit[] {
  const hits: DetectionHit[] = [];

  // 通道一：阈值规则（规则引擎）。
  for (const rule of rules) {
    if (rule.condition.type === 'threshold') {
      if (evaluateThreshold(rule.condition, current.value)) {
        hits.push({
          ruleId: rule.id,
          ruleVersion: rule.version,
          severity: rule.severity,
          anomalyScore: 1,
          baselineValue: rule.condition.threshold,
          actualValue: current.value,
          reason: `观测值 ${current.value} 触发阈值规则「${rule.name}」（${rule.condition.metric} ${rule.condition.operator} ${rule.condition.threshold}）`,
        });
      }
    }
  }

  // 通道二：突降规则（滚动统计对比）。
  for (const rule of rules) {
    if (rule.condition.type !== 'drop') {
      continue;
    }
    const { windowMinutes, dropRatio } = rule.condition;
    const windowStart = current.timestamp.getTime() - windowMinutes * 60 * 1000;
    const windowValues = history
      .filter((o) => o.timestamp.getTime() >= windowStart)
      .map((o) => o.value);
    const stats = rollingStats(windowValues);
    if (stats.count === 0) {
      continue;
    }
    const drop = (stats.mean - current.value) / stats.mean;
    if (drop >= dropRatio) {
      hits.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        severity: rule.severity,
        anomalyScore: Math.min(1, drop),
        baselineValue: stats.mean,
        actualValue: current.value,
        reason: `观测值 ${current.value} 相对 ${windowMinutes} 分钟基线 ${stats.mean.toFixed(3)} 突降 ${(drop * 100).toFixed(1)}%`,
      });
    }
  }

  // 通道三：z-score 内置检测（兜底）。
  // 仅当显式规则未命中时才启用，作为「未覆盖异常」的兜底检测器，
  // 避免与阈值/突降规则产生重复告警。
  // 使用最近一段历史窗口计算基线均值/标准差，判定当前观测是否显著偏离。
  if (hits.length === 0 && history.length >= 2) {
    const stats = rollingStats(history.map((o) => o.value));
    const z = zScore(current.value, stats);
    const absZ = Math.abs(z);
    if (absZ >= zScoreThreshold) {
      const severity = severityFromZScore(absZ);
      if (severity !== 'NORMAL') {
        hits.push({
          // z-score 为内置检测器，无对应 AnomalyRule；ruleId 使用固定标识。
          ruleId: '__zscore__',
          ruleVersion: 1,
          severity,
          anomalyScore: absZ,
          baselineValue: stats.mean,
          actualValue: current.value,
          reason: `z-score ${z.toFixed(2)} 偏离基线（μ=${stats.mean.toFixed(3)}, σ=${stats.stdDev.toFixed(3)}）`,
        });
      }
    }
  }

  return hits;
}
