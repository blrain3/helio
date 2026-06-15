import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { TariffEntity, CreateTariffInput } from '../domain/energy.entity';

/** 费率仓储：封装 Tariff 表的持久化访问。 */
@Injectable()
export class TariffRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TariffEntity | null> {
    const tariff = await this.prisma.tariff.findUnique({ where: { id } });
    return tariff ? this.toEntity(tariff) : null;
  }

  /** 查询在指定时刻生效的费率（生效时间 ≤ 目标时刻，取最近一条）。 */
  async findEffectiveAt(at: Date): Promise<TariffEntity | null> {
    const tariff = await this.prisma.tariff.findFirst({
      where: { effectiveAt: { lte: at } },
      orderBy: { effectiveAt: 'desc' },
    });
    return tariff ? this.toEntity(tariff) : null;
  }

  async findAll(): Promise<TariffEntity[]> {
    const tariffs = await this.prisma.tariff.findMany({
      orderBy: { effectiveAt: 'desc' },
    });
    return tariffs.map((t) => this.toEntity(t));
  }

  async create(input: CreateTariffInput): Promise<TariffEntity> {
    const tariff = await this.prisma.tariff.create({
      data: {
        unitPrice: input.unitPrice,
        currency: input.currency ?? 'CNY',
        billingUnit: input.billingUnit ?? 'kWh',
        effectiveAt: input.effectiveAt,
      },
    });
    return this.toEntity(tariff);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.tariff.delete({ where: { id } });
  }

  private toEntity(t: {
    id: string;
    unitPrice: number;
    currency: string;
    billingUnit: string;
    effectiveAt: Date;
    createdAt: Date;
  }): TariffEntity {
    return {
      id: t.id,
      unitPrice: t.unitPrice,
      currency: t.currency,
      billingUnit: t.billingUnit,
      effectiveAt: t.effectiveAt,
      createdAt: t.createdAt,
    };
  }
}
