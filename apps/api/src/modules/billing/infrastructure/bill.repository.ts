import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { BillEntity, CreateBillInput, BillStatus } from '../domain/bill.entity';

/** 账单仓储：封装 Bill 表的持久化访问。 */
@Injectable()
export class BillRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<BillEntity | null> {
    const bill = await this.prisma.bill.findUnique({ where: { id } });
    return bill ? this.toEntity(bill) : null;
  }

  /** 查询某电站的账单列表。 */
  async findByPlantId(plantId: string): Promise<BillEntity[]> {
    const bills = await this.prisma.bill.findMany({
      where: { plantId },
      orderBy: { periodStart: 'desc' },
    });
    return bills.map((b) => this.toEntity(b));
  }

  async create(input: CreateBillInput & { unitPrice: number; totalAmount: number }): Promise<BillEntity> {
    const bill = await this.prisma.bill.create({
      data: {
        plantId: input.plantId,
        consumedKwh: input.consumedKwh,
        unitPrice: input.unitPrice,
        totalAmount: input.totalAmount,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    });
    return this.toEntity(bill);
  }

  async updateStatus(id: string, status: BillStatus): Promise<BillEntity | null> {
    const bill = await this.prisma.bill.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(bill);
  }

  private toEntity(b: {
    id: string;
    plantId: string;
    consumedKwh: unknown;
    unitPrice: number;
    totalAmount: number;
    periodStart: Date;
    periodEnd: Date;
    status: BillStatus;
    createdAt: Date;
  }): BillEntity {
    return {
      id: b.id,
      plantId: b.plantId,
      // Prisma Decimal 序列化为字符串，统一转为 number（精度已由 Decimal(10,3) 保证）。
      consumedKwh: Number(b.consumedKwh),
      unitPrice: b.unitPrice,
      totalAmount: b.totalAmount,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      status: b.status,
      createdAt: b.createdAt,
    };
  }
}
