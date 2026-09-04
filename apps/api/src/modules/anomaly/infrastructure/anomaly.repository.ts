import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  AnomalyRuleEntity,
  AnomalyEventEntity,
  CreateAnomalyRuleInput,
  UpdateAnomalyRuleInput,
  RuleCondition,
  Severity,
} from '../domain/anomaly.entity';

/**
 * 异常检测仓储：封装 AnomalyRule / AnomalyEvent 两张表的持久化访问。
 */
@Injectable()
export class AnomalyRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== AnomalyRule =====================

  async listRules(enabledOnly = false): Promise<AnomalyRuleEntity[]> {
    const rules = await this.prisma.anomalyRule.findMany({
      where: enabledOnly ? { enabled: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((r) => this.toRuleEntity(r));
  }

  async findRuleById(id: string): Promise<AnomalyRuleEntity | null> {
    const r = await this.prisma.anomalyRule.findUnique({ where: { id } });
    return r ? this.toRuleEntity(r) : null;
  }

  async createRule(input: CreateAnomalyRuleInput): Promise<AnomalyRuleEntity> {
    const r = await this.prisma.anomalyRule.create({
      data: {
        name: input.name,
        condition: input.condition as object,
        severity: input.severity,
        enabled: input.enabled ?? true,
        version: 1,
      },
    });
    return this.toRuleEntity(r);
  }

  /** 更新规则：版本号 +1（规则可追溯）。 */
  async updateRule(
    id: string,
    input: UpdateAnomalyRuleInput,
  ): Promise<AnomalyRuleEntity> {
    const current = await this.prisma.anomalyRule.findUnique({ where: { id } });
    if (!current) {
      throw new Error('规则不存在');
    }
    const r = await this.prisma.anomalyRule.update({
      where: { id },
      data: {
        name: input.name ?? current.name,
        condition: (input.condition as object) ?? (current.condition as object),
        severity: input.severity ?? (current.severity as Severity),
        enabled: input.enabled ?? current.enabled,
        version: current.version + 1,
      },
    });
    return this.toRuleEntity(r);
  }

  async removeRule(id: string): Promise<void> {
    await this.prisma.anomalyRule.delete({ where: { id } });
  }

  // ===================== AnomalyEvent =====================

  async createEvent(data: {
    plantId: string;
    deviceId: string | null;
    ruleId: string;
    ruleVersion: number;
    severity: Severity;
    anomalyScore: number;
    baselineValue: number | null;
    actualValue: number;
    detectedAt: Date;
  }): Promise<AnomalyEventEntity> {
    const e = await this.prisma.anomalyEvent.create({ data });
    return this.toEventEntity(e);
  }

  async listEvents(
    plantId: string,
    start: Date,
    end: Date,
  ): Promise<AnomalyEventEntity[]> {
    const events = await this.prisma.anomalyEvent.findMany({
      where: {
        plantId,
        detectedAt: { gte: start, lt: end },
      },
      orderBy: { detectedAt: 'desc' },
    });
    return events.map((e) => this.toEventEntity(e));
  }

  async listEventsByPlantIds(plantIds: string[]): Promise<AnomalyEventEntity[]> {
    if (plantIds.length === 0) {
      return [];
    }

    const events = await this.prisma.anomalyEvent.findMany({
      where: { plantId: { in: plantIds } },
      orderBy: { detectedAt: 'desc' },
    });
    return events.map((event) => this.toEventEntity(event));
  }

  // ===================== 映射 =====================

  private toRuleEntity(r: {
    id: string;
    name: string;
    condition: unknown;
    severity: string;
    enabled: boolean;
    version: number;
    createdAt: Date;
  }): AnomalyRuleEntity {
    return {
      id: r.id,
      name: r.name,
      condition: r.condition as RuleCondition,
      severity: r.severity as Severity,
      enabled: r.enabled,
      version: r.version,
      createdAt: r.createdAt,
    };
  }

  private toEventEntity(e: {
    id: string;
    plantId: string;
    deviceId: string | null;
    ruleId: string;
    ruleVersion: number;
    severity: string;
    anomalyScore: number;
    baselineValue: number | null;
    actualValue: number;
    detectedAt: Date;
    createdAt: Date;
  }): AnomalyEventEntity {
    return {
      id: e.id,
      plantId: e.plantId,
      deviceId: e.deviceId,
      ruleId: e.ruleId,
      ruleVersion: e.ruleVersion,
      severity: e.severity as Severity,
      anomalyScore: e.anomalyScore,
      baselineValue: e.baselineValue,
      actualValue: e.actualValue,
      detectedAt: e.detectedAt,
      createdAt: e.createdAt,
    };
  }
}
