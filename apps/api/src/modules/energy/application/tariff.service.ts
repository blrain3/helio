import { Injectable } from '@nestjs/common';
import { TariffRepository } from '../infrastructure/tariff.repository';
import { TariffEntity } from '../domain/energy.entity';
import { NotFoundError } from '../../auth/domain/errors';

/**
 * 费率应用服务：费率的创建、查询与删除。
 * 费率是「计量 → 计费」的关键实体，M3 计费模块将据此计算账单金额。
 */
@Injectable()
export class TariffService {
  constructor(private readonly tariffs: TariffRepository) {}

  async findById(id: string): Promise<TariffEntity> {
    const tariff = await this.tariffs.findById(id);
    if (!tariff) {
      throw new NotFoundError('费率不存在');
    }
    return tariff;
  }

  async listAll(): Promise<TariffEntity[]> {
    return this.tariffs.findAll();
  }

  async create(
    unitPrice: number,
    effectiveAt: Date,
    currency?: string,
    billingUnit?: string,
  ): Promise<TariffEntity> {
    return this.tariffs.create({
      unitPrice,
      effectiveAt,
      currency,
      billingUnit,
    });
  }

  async remove(id: string): Promise<void> {
    const tariff = await this.findById(id);
    await this.tariffs.remove(tariff.id);
  }
}
