import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OrderRepository } from '../infrastructure/order.repository';
import { BillRepository } from '../../billing/infrastructure/bill.repository';
import { PlantRepository } from '../../energy/infrastructure/plant.repository';
import {
  OrderEntity,
  OrderStatus,
  canTransition,
} from '../domain/order.entity';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from '../../auth/domain/errors';

/**
 * 订单应用服务：订单创建与状态机流转。
 *
 * 状态机：CREATED → PENDING_PAYMENT → PAID → COMPLETED（异常 CLOSED）。
 * 所有状态流转都经 canTransition 校验，非法流转抛错，保证状态机不被破坏。
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly bills: BillRepository,
    private readonly plants: PlantRepository,
  ) {}

  async findById(id: string): Promise<OrderEntity> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new NotFoundError('订单不存在');
    }
    return order;
  }

  async listByUser(userId: string): Promise<OrderEntity[]> {
    const plants = await this.plants.findByUserId(userId);
    const billGroups = await Promise.all(
      plants.map((plant) => this.bills.findByPlantId(plant.id)),
    );
    return this.orders.findByBillIds(billGroups.flat().map((bill) => bill.id));
  }

  async assertOwnedByUser(id: string, userId: string): Promise<void> {
    const order = await this.findById(id);
    if (!order.billId) {
      throw new ForbiddenError('无权操作该订单');
    }

    const bill = await this.bills.findById(order.billId);
    if (!bill) {
      throw new NotFoundError('账单不存在');
    }
    await this.assertOwnable(bill.plantId, userId);
  }

  /**
   * 创建订单（基于账单）：
   * 1. 校验账单存在；
   * 2. 校验订单金额与账单金额一致（金额校验，防篡改）；
   * 3. 生成唯一订单号，初始状态 CREATED。
   */
  async create(billId: string, amount: number, userId: string): Promise<OrderEntity> {
    const bill = await this.bills.findById(billId);
    if (!bill) {
      throw new NotFoundError('账单不存在');
    }
    await this.assertOwnable(bill.plantId, userId);

    if (amount !== bill.totalAmount) {
      throw new ValidationError('订单金额与账单金额不一致');
    }

    const orderNo = this.generateOrderNo();
    return this.orders.create({ billId, amount, orderNo });
  }

  /** 提交支付：CREATED → PENDING_PAYMENT。 */
  async submitPayment(id: string, userId: string): Promise<OrderEntity> {
    return this.transition(id, userId, 'PENDING_PAYMENT');
  }

  /**
   * 支付成功确认：PENDING_PAYMENT → PAID。
   * M4 支付回调将调用此方法完成订单状态推进，并联动账单标记为已支付。
   */
  async confirmPaid(id: string): Promise<OrderEntity> {
    const order = await this.transition(id, undefined, 'PAID');
    // 联动：订单支付成功 → 账单标记为已支付。
    if (order.billId) {
      await this.bills.updateStatus(order.billId, 'PAID');
    }
    return order;
  }

  /** 完成订单：PAID → COMPLETED。 */
  async complete(id: string, userId: string): Promise<OrderEntity> {
    return this.transition(id, userId, 'COMPLETED');
  }

  /** 关闭订单（超时/取消）：CREATED 或 PENDING_PAYMENT → CLOSED。 */
  async close(id: string, userId: string): Promise<OrderEntity> {
    return this.transition(id, userId, 'CLOSED');
  }

  /**
   * 状态机流转：校验归属 + 校验合法流转后更新状态。
   * @param userId 为 undefined 时跳过归属校验（供支付回调等系统级操作使用）。
   */
  private async transition(
    id: string,
    userId: string | undefined,
    target: OrderStatus,
  ): Promise<OrderEntity> {
    const order = await this.findById(id);

    if (userId !== undefined && order.billId) {
      const bill = await this.bills.findById(order.billId);
      if (bill) {
        await this.assertOwnable(bill.plantId, userId);
      }
    }

    if (!canTransition(order.status, target)) {
      throw new ValidationError(
        `订单状态不允许从 ${order.status} 流转到 ${target}`,
      );
    }

    const updated = await this.orders.updateStatus(id, target);
    if (!updated) {
      throw new NotFoundError('订单不存在');
    }
    return updated;
  }

  private async assertOwnable(plantId: string, userId: string): Promise<void> {
    const plant = await this.plants.findById(plantId);
    if (!plant) {
      throw new NotFoundError('电站不存在');
    }
    if (plant.userId !== userId) {
      throw new ForbiddenError('无权操作该订单');
    }
  }

  /** 生成订单号：时间戳 + 随机段，保证唯一。 */
  private generateOrderNo(): string {
    const ts = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return `ORD${ts}${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  }
}
