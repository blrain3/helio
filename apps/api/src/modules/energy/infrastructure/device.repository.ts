import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  DeviceEntity,
  CreateDeviceInput,
  UpdateDeviceInput,
  DeviceType,
} from '../domain/energy.entity';

/** 设备仓储：封装 Device 表的持久化访问。 */
@Injectable()
export class DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DeviceEntity | null> {
    const device = await this.prisma.device.findUnique({ where: { id } });
    return device ? this.toEntity(device) : null;
  }

  async findBySerialNo(serialNo: string): Promise<DeviceEntity | null> {
    const device = await this.prisma.device.findUnique({ where: { serialNo } });
    return device ? this.toEntity(device) : null;
  }

  /** 查询某电站下的全部设备。 */
  async findByPlantId(plantId: string): Promise<DeviceEntity[]> {
    const devices = await this.prisma.device.findMany({
      where: { plantId },
      orderBy: { createdAt: 'desc' },
    });
    return devices.map((d) => this.toEntity(d));
  }

  async create(input: CreateDeviceInput): Promise<DeviceEntity> {
    const device = await this.prisma.device.create({
      data: {
        serialNo: input.serialNo,
        name: input.name ?? '',
        type: input.type ?? 'INVERTER',
        plantId: input.plantId,
      },
    });
    return this.toEntity(device);
  }

  async update(id: string, input: UpdateDeviceInput): Promise<DeviceEntity | null> {
    const device = await this.prisma.device.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.type !== undefined && { type: input.type }),
      },
    });
    return this.toEntity(device);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.device.delete({ where: { id } });
  }

  private toEntity(d: {
    id: string;
    serialNo: string;
    name: string;
    type: string;
    plantId: string;
    createdAt: Date;
    updatedAt: Date;
  }): DeviceEntity {
    return {
      id: d.id,
      serialNo: d.serialNo,
      name: d.name,
      type: d.type as DeviceType,
      plantId: d.plantId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
}
