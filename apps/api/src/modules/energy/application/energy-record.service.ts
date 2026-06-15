import { Injectable } from '@nestjs/common';
import { EnergyRecordRepository } from '../infrastructure/energy-record.repository';
import { DeviceRepository } from '../infrastructure/device.repository';
import { PlantRepository } from '../infrastructure/plant.repository';
import { CreateEnergyRecordInput, EnergyRecordEntity } from '../domain/energy.entity';
import { NotFoundError, ForbiddenError } from '../../auth/domain/errors';

/**
 * 发电记录应用服务：发电数据的写入与聚合查询。
 *
 * 写入链路：校验设备/电站归属 → 自动建分区 → 写入时序分区表。
 * 查询链路：按电站做日聚合 / 总汇总。
 */
@Injectable()
export class EnergyRecordService {
  constructor(
    private readonly records: EnergyRecordRepository,
    private readonly devices: DeviceRepository,
    private readonly plants: PlantRepository,
  ) {}

  async record(input: CreateEnergyRecordInput, userId: string): Promise<void> {
    const plant = await this.plants.findById(input.plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权向该电站写入数据');
    }
    const device = await this.devices.findById(input.deviceId);
    if (!device || device.plantId !== input.plantId) {
      throw new NotFoundError('设备不存在或不属于该电站');
    }
    await this.records.create(input);
  }

  /** 批量写入（供 worker 或采集端使用）。 */
  async recordMany(inputs: CreateEnergyRecordInput[], userId: string): Promise<void> {
    for (const input of inputs) {
      await this.record(input, userId);
    }
  }

  async listByPlant(
    plantId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<EnergyRecordEntity[]> {
    await this.assertOwnable(plantId, userId);
    return this.records.findByPlantId(plantId, start, end);
  }

  async dailyAggregate(
    plantId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<Array<{ day: Date; totalKwh: number; recordCount: number }>> {
    await this.assertOwnable(plantId, userId);
    return this.records.aggregateDaily(plantId, start, end);
  }

  async totalAggregate(
    plantId: string,
    userId: string,
    start: Date,
    end: Date,
  ): Promise<{ totalKwh: number; recordCount: number }> {
    await this.assertOwnable(plantId, userId);
    return this.records.aggregateTotal(plantId, start, end);
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
