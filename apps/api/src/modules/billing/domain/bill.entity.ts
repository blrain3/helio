/**
 * 计费域领域实体与输入类型。
 *
 * 核心语义（解决原项目「计量单位与支付单位混淆」的问题）：
 * - 发电量（consumedKwh）只是业务计量数据；
 * - 账单金额（totalAmount）由 `consumed_kwh × unit_price` 计算，以「分」为整数单位；
 * - 支付渠道只接受金额（OrderAmount），不直接接触发电量。
 */

/** 账单状态机：PENDING → ISSUED → PAID。 */
export type BillStatus = 'PENDING' | 'ISSUED' | 'PAID';

/** 账单。 */
export interface BillEntity {
  id: string;
  plantId: string;
  /** 发电量（kWh），Decimal 精度，对齐时序 NUMERIC(10,3)。 */
  consumedKwh: number;
  /** 单价（分 / billingUnit）。 */
  unitPrice: number;
  /** 总额（分），整数运算避免浮点误差。 */
  totalAmount: number;
  periodStart: Date;
  periodEnd: Date;
  status: BillStatus;
  createdAt: Date;
}

/** 生成账单的输入。 */
export interface CreateBillInput {
  plantId: string;
  /** 该计费周期内的发电量（kWh）。 */
  consumedKwh: number;
  periodStart: Date;
  periodEnd: Date;
}

/** 金额计算结果（值对象）。 */
export interface AmountCalculation {
  /** 发电量（kWh）。 */
  quantity: number;
  /** 单价（分）。 */
  unitPrice: number;
  /** 总额（分），= round(quantity × unitPrice)。 */
  totalAmount: number;
}
