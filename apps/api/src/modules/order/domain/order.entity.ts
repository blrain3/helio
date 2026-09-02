/**
 * 订单域领域实体与状态机定义。
 *
 * 订单状态机（独立于支付/退款状态机，符合架构约定）：
 *   CREATED → PENDING_PAYMENT → PAID → COMPLETED
 *                        ↓
 *                     CLOSED（超时/取消）
 */

/** 订单状态。 */
export type OrderStatus = 'CREATED' | 'PENDING_PAYMENT' | 'PAID' | 'COMPLETED' | 'CLOSED';

/** 订单。 */
export interface OrderEntity {
  id: string;
  orderNo: string;
  billId: string | null;
  /** 订单金额（分），与账单金额一致。 */
  amount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建订单的输入。 */
export interface CreateOrderInput {
  billId: string;
  amount: number;
}

/**
 * 订单状态机：定义合法状态流转。
 * 非法流转由 OrderService 校验并抛错，保证状态机不被破坏。
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ['PENDING_PAYMENT', 'CLOSED'],
  PENDING_PAYMENT: ['PAID', 'CLOSED'],
  PAID: ['COMPLETED'],
  COMPLETED: [],
  CLOSED: [],
};

/** 判断从 from 到 to 是否为合法流转。 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}
