import { Injectable } from '@nestjs/common';
import { BillRepository } from '../infrastructure/bill.repository';
import { TariffRepository } from '../../energy/infrastructure/tariff.repository';
import { PlantRepository } from '../../energy/infrastructure/plant.repository';
import { AmountCalculator } from '../domain/amount-calculator';
import { BillEntity, CreateBillInput } from '../domain/bill.entity';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../auth/domain/errors';

/**
 * 计费应用服务：账单生成、查询、状态流转。
 *
 * 核心链路：EnergyRecord（计量）→ Tariff（费率）→ Bill（账单）。
 * 生成账单时：取目标周期生效费率 → 计算金额（分）→ 持久化账单。
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly bills: BillRepository,
    private readonly tariffs: TariffRepository,
    private readonly plants: PlantRepository,
    private readonly calculator: AmountCalculator,
  ) {}

  async findById(id: string): Promise<BillEntity> {
    const bill = await this.bills.findById(id);
    if (!bill) {
      throw new NotFoundError('账单不存在');
    }
    return bill;
  }

  async listByPlant(plantId: string): Promise<BillEntity[]> {
    return this.bills.findByPlantId(plantId);
  }

  async listByUser(userId: string): Promise<BillEntity[]> {
    const plants = await this.plants.findByUserId(userId);
    const groups = await Promise.all(
      plants.map((plant) => this.bills.findByPlantId(plant.id)),
    );
    return groups.flat();
  }

  /**
   * 生成账单：
   * 1. 校验电站存在且归属当前用户；
   * 2. 取周期结束时刻生效的费率；
   * 3. amount = round(consumed_kwh × unit_price)（分）；
   * 4. 持久化（初始状态 PENDING）。
   */
  async generate(input: CreateBillInput, userId: string): Promise<BillEntity> {
    const plant = await this.plants.findById(input.plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权为该电站生成账单');
    }
    if (input.consumedKwh < 0) {
      throw new ValidationError('发电量不能为负');
    }
    if (input.periodStart >= input.periodEnd) {
      throw new ValidationError('计费周期起始时间必须早于结束时间');
    }

    // 取周期结束时刻生效的费率。
    const tariff = await this.tariffs.findEffectiveAt(input.periodEnd);
    if (!tariff) {
      throw new NotFoundError('未找到生效的费率');
    }

    const calc = this.calculator.calculate(input.consumedKwh, tariff.unitPrice);

    return this.bills.create({
      ...input,
      unitPrice: tariff.unitPrice,
      totalAmount: calc.totalAmount,
    });
  }

  /** 标记账单为已发出（ISSUED）。 */
  async issue(id: string, userId: string): Promise<BillEntity> {
    const bill = await this.findById(id);
    await this.assertOwnable(bill.plantId, userId);
    if (bill.status !== 'PENDING') {
      throw new ValidationError('仅 PENDING 状态的账单可发出');
    }
    const updated = await this.bills.updateStatus(id, 'ISSUED');
    if (!updated) {
      throw new NotFoundError('账单不存在');
    }
    return updated;
  }

  /** 标记账单为已支付（PAID），由订单支付成功后触发。 */
  async markPaid(id: string): Promise<BillEntity> {
    const bill = await this.findById(id);
    if (bill.status !== 'ISSUED' && bill.status !== 'PENDING') {
      throw new ValidationError('账单状态不允许标记为已支付');
    }
    const updated = await this.bills.updateStatus(id, 'PAID');
    if (!updated) {
      throw new NotFoundError('账单不存在');
    }
    return updated;
  }

  private async assertOwnable(plantId: string, userId: string): Promise<void> {
    const plant = await this.plants.findById(plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权操作该账单');
    }
  }
}
