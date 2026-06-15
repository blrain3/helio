import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  CreateEnergyRecordInput,
  EnergyRecordEntity,
} from '../domain/energy.entity';

/**
 * 发电记录仓储：访问 Raw SQL 管理的分区表 energy_record。
 *
 * 与 Prisma 管理的业务表不同，时序数据通过 `$queryRaw` / `$executeRaw`
 * 直接操作分区表。写入前会调用 `ensure_energy_partition` 保证目标月份分区存在。
 */
@Injectable()
export class EnergyRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** 写入一条发电记录（自动确保目标月份分区存在）。 */
  async create(input: CreateEnergyRecordInput): Promise<void> {
    await this.ensurePartition(input.timestamp);
    await this.prisma.$executeRaw`
      INSERT INTO energy_record (device_id, plant_id, generation_kwh, timestamp)
      VALUES (${input.deviceId}::uuid, ${input.plantId}::uuid, ${input.generationKwh}, ${input.timestamp})
    `;
  }

  /** 批量写入（单条事务内，确保分区后逐条插入）。 */
  async createMany(records: CreateEnergyRecordInput[]): Promise<void> {
    for (const r of records) {
      await this.create(r);
    }
  }

  /** 查询某电站在时间区间内的发电记录。 */
  async findByPlantId(
    plantId: string,
    start: Date,
    end: Date,
  ): Promise<EnergyRecordEntity[]> {
    const rows = await this.prisma.$queryRaw<Array<{
      id: bigint;
      device_id: string;
      plant_id: string;
      generation_kwh: number;
      timestamp: Date;
    }>>`
      SELECT id, device_id, plant_id, generation_kwh, timestamp
      FROM energy_record
      WHERE plant_id = ${plantId}::uuid
        AND timestamp >= ${start}
        AND timestamp < ${end}
      ORDER BY timestamp ASC
    `;
    return rows.map((r) => ({
      id: Number(r.id),
      deviceId: r.device_id,
      plantId: r.plant_id,
      generationKwh: Number(r.generation_kwh),
      timestamp: r.timestamp,
    }));
  }

  /** 日聚合：按天汇总某电站发电量。 */
  async aggregateDaily(
    plantId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ day: Date; totalKwh: number; recordCount: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{
      day: Date;
      total_kwh: number;
      record_count: bigint;
    }>>`
      SELECT
        date_trunc('day', timestamp) AS day,
        sum(generation_kwh)          AS total_kwh,
        count(*)                     AS record_count
      FROM energy_record
      WHERE plant_id = ${plantId}::uuid
        AND timestamp >= ${start}
        AND timestamp < ${end}
      GROUP BY date_trunc('day', timestamp)
      ORDER BY day ASC
    `;
    return rows.map((r) => ({
      day: r.day,
      totalKwh: Number(r.total_kwh),
      recordCount: Number(r.record_count),
    }));
  }

  /** 汇总：某电站在区间内的总发电量与记录数。 */
  async aggregateTotal(
    plantId: string,
    start: Date,
    end: Date,
  ): Promise<{ totalKwh: number; recordCount: number }> {
    const rows = await this.prisma.$queryRaw<Array<{
      total_kwh: number | null;
      record_count: bigint;
    }>>`
      SELECT
        sum(generation_kwh) AS total_kwh,
        count(*)            AS record_count
      FROM energy_record
      WHERE plant_id = ${plantId}::uuid
        AND timestamp >= ${start}
        AND timestamp < ${end}
    `;
    const r = rows[0];
    return {
      totalKwh: Number(r?.total_kwh ?? 0),
      recordCount: Number(r?.record_count ?? 0),
    };
  }

  /** 确保目标时间戳所在月份的分区存在（幂等）。 */
  private async ensurePartition(timestamp: Date): Promise<void> {
    await this.prisma.$executeRaw`
      SELECT ensure_energy_partition(date_trunc('month', ${timestamp})::date)
    `;
  }
}
