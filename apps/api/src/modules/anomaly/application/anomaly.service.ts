import { Injectable } from '@nestjs/common';
import { AnomalyRepository } from '../infrastructure/anomaly.repository';
import { EnergyRecordRepository } from '../../energy/infrastructure/energy-record.repository';
import { PlantRepository } from '../../energy/infrastructure/plant.repository';
import {
  AnomalyRuleEntity,
  AnomalyEventEntity,
  CreateAnomalyRuleInput,
  UpdateAnomalyRuleInput,
} from '../domain/anomaly.entity';
import {
  detectAnomalies,
  Observation,
} from '../domain/detection';
import {
  NotFoundError,
  ForbiddenError,
} from '../../auth/domain/errors';

/**
 * 异常检测应用服务。
 *
 * 检测链路：
 *   读取启用规则 + 拉取时序历史窗口 + 对当前观测点执行检测引擎
 *   → 将命中的告警持久化为 AnomalyEvent。
 *
 * 供两类调用方使用：
 * - worker：消费 anomaly 队列，触发对某电站的批量检测（无需登录态）；
 * - 管理端：OPERATOR/ADMIN 通过 HTTP 触发即时检测（需登录态）。
 */
@Injectable()
export class AnomalyService {
  constructor(
    private readonly anomalies: AnomalyRepository,
    private readonly records: EnergyRecordRepository,
    private readonly plants: PlantRepository,
  ) {}

  // ===================== 规则管理 =====================

  async listRules(enabledOnly = false): Promise<AnomalyRuleEntity[]> {
    return this.anomalies.listRules(enabledOnly);
  }

  async createRule(input: CreateAnomalyRuleInput): Promise<AnomalyRuleEntity> {
    return this.anomalies.createRule(input);
  }

  async updateRule(
    id: string,
    input: UpdateAnomalyRuleInput,
  ): Promise<AnomalyRuleEntity> {
    const existing = await this.anomalies.findRuleById(id);
    if (!existing) {
      throw new NotFoundError('检测规则不存在');
    }
    return this.anomalies.updateRule(id, input);
  }

  async removeRule(id: string): Promise<void> {
    const existing = await this.anomalies.findRuleById(id);
    if (!existing) {
      throw new NotFoundError('检测规则不存在');
    }
    await this.anomalies.removeRule(id);
  }

  // ===================== 检测执行 =====================

  /**
   * 对某电站执行异常检测。
   *
   * @param plantId 目标电站
   * @param now 当前观测点（时间 + 观测值），缺省取该电站区间内最新一条记录
   * @param windowHours 历史窗口（小时），用于滚动统计与 z-score 基线
   * @param userId 可选，传入时校验电站归属（HTTP 路径），worker 调用不传
   * @returns 命中的告警（已落库）
   */
  async detect(
    plantId: string,
    now: { value: number; timestamp: Date },
    windowHours = 24,
    userId?: string,
  ): Promise<AnomalyEventEntity[]> {
    if (userId) {
      await this.assertOwnable(plantId, userId);
    }

    const rules = await this.anomalies.listRules(true);
    if (rules.length === 0) {
      return [];
    }

    const end = now.timestamp;
    const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
    const historyRecords = await this.records.findByPlantId(plantId, start, end);
    const history: Observation[] = historyRecords.map((r) => ({
      value: r.generationKwh,
      timestamp: r.timestamp,
    }));

    const current: Observation = {
      value: now.value,
      timestamp: now.timestamp,
    };

    const hits = detectAnomalies(rules, current, history);
    const events: AnomalyEventEntity[] = [];
    for (const hit of hits) {
      // z-score 内置检测无真实规则，ruleId 使用固定标识；否则用规则 id/版本。
      const ruleId = hit.ruleId === '__zscore__' ? hit.ruleId : hit.ruleId;
      const event = await this.anomalies.createEvent({
        plantId,
        deviceId: null,
        ruleId,
        ruleVersion: hit.ruleVersion,
        severity: hit.severity,
        anomalyScore: hit.anomalyScore,
        baselineValue: hit.baselineValue,
        actualValue: hit.actualValue,
        detectedAt: now.timestamp,
      });
      events.push(event);
    }
    return events;
  }

  /**
   * 对某电站执行检测，当前观测点自动取区间内最新一条记录。
   * 供 worker 消费异常检测任务时调用（无需显式观测值）。
   */
  async detectLatest(
    plantId: string,
    windowHours = 24,
  ): Promise<AnomalyEventEntity[]> {
    const end = new Date();
    const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);
    const recent = await this.records.findByPlantId(plantId, start, end);
    if (recent.length === 0) {
      return [];
    }
    const latest = recent[recent.length - 1]!;
    return this.detect(
      plantId,
      { value: latest.generationKwh, timestamp: latest.timestamp },
      windowHours,
    );
  }

  // ===================== 查询 =====================

  async listEvents(
    plantId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<AnomalyEventEntity[]> {
    await this.assertOwnable(plantId, userId);
    return this.anomalies.listEvents(plantId, start, end);
  }

  private async assertOwnable(plantId: string, userId: string): Promise<void> {
    const plant = await this.plants.findById(plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权访问该电站数据');
    }
  }
}
