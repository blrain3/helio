import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import {
  PlantEntity,
  CreatePlantInput,
  UpdatePlantInput,
} from '../domain/energy.entity';

/** 电站仓储：封装 Plant 表的持久化访问。 */
@Injectable()
export class PlantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<PlantEntity | null> {
    const plant = await this.prisma.plant.findUnique({ where: { id } });
    return plant ? this.toEntity(plant) : null;
  }

  /** 按用户查询其名下全部电站。 */
  async findByUserId(userId: string): Promise<PlantEntity[]> {
    const plants = await this.prisma.plant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return plants.map((p) => this.toEntity(p));
  }

  async create(input: CreatePlantInput): Promise<PlantEntity> {
    const plant = await this.prisma.plant.create({
      data: {
        name: input.name,
        capacity: input.capacity,
        location: input.location ?? null,
        userId: input.userId,
      },
    });
    return this.toEntity(plant);
  }

  async update(id: string, input: UpdatePlantInput): Promise<PlantEntity | null> {
    const plant = await this.prisma.plant.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.location !== undefined && { location: input.location }),
      },
    });
    return this.toEntity(plant);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.plant.delete({ where: { id } });
  }

  private toEntity(p: {
    id: string;
    name: string;
    capacity: number;
    location: string | null;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  }): PlantEntity {
    return {
      id: p.id,
      name: p.name,
      capacity: p.capacity,
      location: p.location,
      userId: p.userId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
