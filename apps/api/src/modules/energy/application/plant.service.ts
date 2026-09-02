import { Injectable } from '@nestjs/common';
import { PlantRepository } from '../infrastructure/plant.repository';
import { PlantEntity } from '../domain/energy.entity';
import { NotFoundError, ForbiddenError } from '../../auth/domain/errors';

/**
 * 电站应用服务：电站的创建、查询、更新与删除。
 * 关键规则：用户只能操作自己名下的电站（资源归属校验）。
 */
@Injectable()
export class PlantService {
  constructor(private readonly plants: PlantRepository) {}

  async findById(id: string): Promise<PlantEntity> {
    const plant = await this.plants.findById(id);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    return plant;
  }

  async listByUser(userId: string): Promise<PlantEntity[]> {
    return this.plants.findByUserId(userId);
  }

  async create(
    name: string,
    capacity: number,
    location: string | undefined,
    userId: string,
  ): Promise<PlantEntity> {
    return this.plants.create({
      name,
      capacity,
      location: location ?? null,
      userId,
    });
  }

  async update(
    id: string,
    userId: string,
    input: { name?: string; capacity?: number; location?: string },
  ): Promise<PlantEntity> {
    const plant = await this.findById(id);
    this.assertOwner(plant, userId);
    const updated = await this.plants.update(id, input);
    // update 在 id 存在前提下必返回实体，防御性兜底。
    if (!updated) {
      throw new NotFoundError('电站不存在');
    }
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const plant = await this.findById(id);
    this.assertOwner(plant, userId);
    await this.plants.remove(id);
  }

  /** 资源归属校验：非本人且非管理员不可操作。 */
  private assertOwner(plant: PlantEntity, userId: string): void {
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权操作该电站');
    }
  }
}
