import { PrismaClient } from '@prisma/client';

/**
 * 异常检测任务处理器（M5b）。
 *
 * 触发方式：api 侧（或定时调度）向 anomaly 队列投递 AnomalyDetection 事件，
 * 负载为 { plantId, deviceId?, value?, timestamp?, windowHours? }。
 *
 * 检测逻辑（与 api 侧 AnomalyService 语义一致，worker 独立实现以保持解耦）：
 *   1. 读取该电站启用的 AnomalyRule；
 *   2. 拉取历史窗口内的 energy_record（滚动统计基线）；
 *   3. 执行阈值规则 / 突降规则 / z-score 检测；
 *   4. 命中的告警持久化为 AnomalyEvent。
 */

type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL';
type RuleCondition =
  | { type: 'threshold'; metric: string; operator: string; threshold: number }
  | { type: 'drop'; metric: string; windowMinutes: number; dropRatio: number };

interface AnomalyRuleRow {
  id: string;
  name: string;
  condition: RuleCondition;
  severity: Severity;
  version: number;
}

interface EnergyRow {
  generation_kwh: number;
  timestamp: Date;
}

interface DetectionHit {
  ruleId: string;
  ruleVersion: number;
  severity: Severity;
  anomalyScore: number;
  baselineValue: number | null;
  actualValue: number;
}

function rollingStats(values: number[]): { count: number; mean: number; stdDev: number } {
  const count = values.length;
  if (count === 0) return { count: 0, mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / count;
  if (count < 2) return { count, mean, stdDev: 0 };
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (count - 1);
  return { count, mean, stdDev: Math.sqrt(variance) };
}

function severityFromZScore(absScore: number): Severity {
  if (absScore >= 3) return 'CRITICAL';
  if (absScore >= 2) return 'WARNING';
  return 'NORMAL';
}

function evaluateThreshold(cond: RuleCondition, value: number): boolean {
  if (cond.type !== 'threshold') return false;
  switch (cond.operator) {
    case 'GT':
      return value > cond.threshold;
    case 'LT':
      return value < cond.threshold;
    case 'GTE':
      return value >= cond.threshold;
    case 'LTE':
      return value <= cond.threshold;
    default:
      return false;
  }
}

export async function handleAnomaly(
  payload: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<void> {
  const plantId = payload.plantId as string;
  if (!plantId) {
    throw new Error('异常检测任务缺少 plantId');
  }

  const windowHours = Number(payload.windowHours ?? 24);
  const now = payload.timestamp ? new Date(payload.timestamp as string) : new Date();
  const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  // 1. 读取启用规则。
  const rules = (await prisma.$queryRaw`
    SELECT id, name, condition, severity, version
    FROM "AnomalyRule"
    WHERE enabled = true
  `) as AnomalyRuleRow[];
  if (rules.length === 0) {
    return;
  }

  // 2. 拉取历史窗口时序。
  const rows = (await prisma.$queryRaw`
    SELECT generation_kwh, timestamp
    FROM energy_record
    WHERE plant_id = ${plantId}::uuid
      AND timestamp >= ${start}
      AND timestamp < ${now}
    ORDER BY timestamp ASC
  `) as EnergyRow[];

  const historyValues = rows.map((r) => Number(r.generation_kwh));

  // 3. 当前观测值：显式传入或取最新一条。
  let currentValue: number;
  if (typeof payload.value === 'number') {
    currentValue = payload.value;
  } else {
    if (rows.length === 0) {
      return; // 无观测值，无法检测。
    }
    currentValue = Number(rows[rows.length - 1]!.generation_kwh);
  }

  // 4. 执行检测。
  const hits: DetectionHit[] = [];

  for (const rule of rules) {
    const cond = rule.condition;
    if (cond.type === 'threshold' && evaluateThreshold(cond, currentValue)) {
      hits.push({
        ruleId: rule.id,
        ruleVersion: rule.version,
        severity: rule.severity,
        anomalyScore: 1,
        baselineValue: cond.threshold,
        actualValue: currentValue,
      });
    } else if (cond.type === 'drop') {
      const windowStart = now.getTime() - cond.windowMinutes * 60 * 1000;
      const windowValues = rows
        .filter((r) => r.timestamp.getTime() >= windowStart)
        .map((r) => Number(r.generation_kwh));
      const stats = rollingStats(windowValues);
      if (stats.count > 0) {
        const drop = (stats.mean - currentValue) / stats.mean;
        if (drop >= cond.dropRatio) {
          hits.push({
            ruleId: rule.id,
            ruleVersion: rule.version,
            severity: rule.severity,
            anomalyScore: Math.min(1, drop),
            baselineValue: stats.mean,
            actualValue: currentValue,
          });
        }
      }
    }
  }

  // 5. z-score 内置检测（兜底：仅当显式规则未命中时启用）。
  if (hits.length === 0 && historyValues.length >= 2) {
    const stats = rollingStats(historyValues);
    const z = stats.stdDev === 0 ? 0 : (currentValue - stats.mean) / stats.stdDev;
    const absZ = Math.abs(z);
    if (absZ >= 3) {
      const severity = severityFromZScore(absZ);
      if (severity !== 'NORMAL') {
        hits.push({
          ruleId: '__zscore__',
          ruleVersion: 1,
          severity,
          anomalyScore: absZ,
          baselineValue: stats.mean,
          actualValue: currentValue,
        });
      }
    }
  }

  // 6. 持久化。
  for (const hit of hits) {
    await prisma.anomalyEvent.create({
      data: {
        plantId,
        deviceId: (payload.deviceId as string) ?? null,
        ruleId: hit.ruleId,
        ruleVersion: hit.ruleVersion,
        severity: hit.severity,
        anomalyScore: hit.anomalyScore,
        baselineValue: hit.baselineValue,
        actualValue: hit.actualValue,
        detectedAt: now,
      },
    });
  }
}
