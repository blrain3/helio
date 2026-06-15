import { Injectable } from '@nestjs/common';
import { AmountCalculation } from '../domain/bill.entity';

/**
 * 金额计算服务（领域服务）。
 *
 * 核心职责：把业务计量值（发电量 kWh）转换为支付金额（分），
 * 解耦「计量单位」与「支付单位」，解决原系统将 generation_kwh
 * 直接映射为支付 quantity 导致的语义错误。
 *
 * 规则：
 * 1. amount = round(quantity × unitPrice)，单位为「分」；
 * 2. 全程整数/定点运算，避免浮点误差（金额精度由「分」保证）。
 */
@Injectable()
export class AmountCalculator {
  /**
   * 计算账单金额。
   * @param quantityKwh 发电量（kWh）
   * @param unitPriceFen 单价（分 / kWh）
   * @returns 金额计算详情（总额为整数「分」）
   */
  calculate(quantityKwh: number, unitPriceFen: number): AmountCalculation {
    // 用「分」为单位做定点运算：先放大 100 倍避免浮点，再四舍五入。
    const totalFen = Math.round(quantityKwh * unitPriceFen);
    return {
      quantity: quantityKwh,
      unitPrice: unitPriceFen,
      totalAmount: totalFen,
    };
  }
}
