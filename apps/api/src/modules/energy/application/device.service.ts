import { Injectable } from '@nestjs/common';
import { DeviceRepository } from '../infrastructure/device.repository';
import { PlantRepository } from '../infrastructure/plant.repository';
import { DeviceEntity, DeviceType } from '../domain/energy.entity';
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../auth/domain/errors';

/**
 * 设备应用服务：设备的创建、查询、更新与删除。
 * 关键规则：
 * 1. 设备必须挂靠在已存在的电站下；
 * 2. 序列号全局唯一；
 * 3. 用户只能操作自己名下电站的设备。
 */
@Injectable()
export class DeviceService {
  constructor(
    private readonly devices: DeviceRepository,
    private readonly plants: PlantRepository,
  ) {}

  async findById(id: string): Promise<DeviceEntity> {
    const device = await this.devices.findById(id);
    if (!device) {
      throw new NotFoundError('设备不存在');
    }
    return device;
  }

  async listByPlant(plantId: string): Promise<DeviceEntity[]> {
    return this.devices.findByPlantId(plantId);
  }

  async create(
    serialNo: string,
    plantId: string,
    name: string | undefined,
    type: DeviceType | undefined,
    userId: string,
  ): Promise<DeviceEntity> {
    const plant = await this.plants.findById(plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权在该电站下创建设备');
    }
    if (await this.devices.findBySerialNo(serialNo)) {
      throw new ConflictError('设备序列号已存在');
    }
    return this.devices.create({ serialNo, plantId, name, type });
  }

  async update(
    id: string,
    userId: string,
    input: { name?: string; type?: DeviceType },
  ): Promise<DeviceEntity> {
    const device = await this.findById(id);
    await this.assertOwnable(device.plantId, userId);
    const updated = await this.devices.update(id, input);
    if (!updated) {
      throw new NotFoundError('设备不存在');
    }
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const device = await this.findById(id);
    await this.assertOwnable(device.plantId, userId);
    await this.devices.remove(id);
  }

  /** 校验设备所属电站归属当前用户。 */
  private async assertOwnable(plantId: string, userId: string): Promise<void> {
    const plant = await this.plants.findById(plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权操作该设备');
    }
  }
}
