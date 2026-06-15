/**
 * 异常检测域实体与输入类型。
 *
 * AnomalyRule 为「检测规则」（可解释、可版本化），AnomalyEvent 为「检测结果」
 * （可追溯、可查询）。与 energy 域一致，接口描述领域实体，由 infrastructure 层
 * 负责 Prisma 模型到领域实体的映射。
 */

/** 异常严重级别。 */
export type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL';

/** 规则引擎支持的操作符。 */
export type RuleOperator = 'GT' | 'LT' | 'GTE' | 'LTE';

/**
 * 规则条件（condition 字段，Json 类型）。
 *
 * 支持两类条件：
 * - 阈值规则：{ type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 }
 * - 突降规则：{ type: 'drop', metric: 'generationKwh', windowMinutes: 60, dropRatio: 0.5 }
 *
 * z-score 检测为内置检测器，不受 condition 控制（见 detection.ts）。
 */
export type RuleCondition =
  | {
      type: 'threshold';
      metric: 'generationKwh';
      operator: RuleOperator;
      threshold: number;
    }
  | {
      type: 'drop';
      metric: 'generationKwh';
      /** 对比窗口（分钟）。 */
      windowMinutes: number;
      /** 突降比例（当前相对基线下降超过该比例即告警）。 */
      dropRatio: number;
    };

/** 检测规则（持久化于 AnomalyRule 表）。 */
export interface AnomalyRuleEntity {
  id: string;
  name: string;
  condition: RuleCondition;
  severity: Severity;
  enabled: boolean;
  version: number;
  createdAt: Date;
}

/** 创建规则的输入。 */
export interface CreateAnomalyRuleInput {
  name: string;
  condition: RuleCondition;
  severity: Severity;
  enabled?: boolean;
}

/** 更新规则的输入（修改即版本号 +1）。 */
export interface UpdateAnomalyRuleInput {
  name?: string;
  condition?: RuleCondition;
  severity?: Severity;
  enabled?: boolean;
}

/** 异常事件（检测结果，持久化于 AnomalyEvent 表）。 */
export interface AnomalyEventEntity {
  id: string;
  plantId: string;
  deviceId: string | null;
  ruleId: string;
  ruleVersion: number;
  severity: Severity;
  anomalyScore: number;
  baselineValue: number | null;
  actualValue: number;
  detectedAt: Date;
  createdAt: Date;
}

/** 检测引擎产出的单个告警（尚未落库）。 */
export interface DetectionHit {
  ruleId: string;
  ruleVersion: number;
  severity: Severity;
  anomalyScore: number;
  baselineValue: number | null;
  actualValue: number;
  /** 命中的具体原因，便于人工解释。 */
  reason: string;
}
