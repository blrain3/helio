import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { OrderEntity, CreateOrderInput, OrderStatus } from '../domain/order.entity';

/** 订单仓储：封装 Order 表的持久化访问。 */
@Injectable()
export class OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    return order ? this.toEntity(order) : null;
  }

  async findByOrderNo(orderNo: string): Promise<OrderEntity | null> {
    const order = await this.prisma.order.findUnique({ where: { orderNo } });
    return order ? this.toEntity(order) : null;
  }

  async create(input: CreateOrderInput & { orderNo: string }): Promise<OrderEntity> {
    const order = await this.prisma.order.create({
      data: {
        orderNo: input.orderNo,
        billId: input.billId,
        amount: input.amount,
        status: 'CREATED',
      },
    });
    return this.toEntity(order);
  }

  /** 更新订单状态（由状态机校验合法性后调用）。 */
  async updateStatus(id: string, status: OrderStatus): Promise<OrderEntity | null> {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
    });
    return this.toEntity(order);
  }

  private toEntity(o: {
    id: string;
    orderNo: string;
    billId: string | null;
    amount: number;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
  }): OrderEntity {
    return {
      id: o.id,
      orderNo: o.orderNo,
      billId: o.billId,
      amount: o.amount,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }
}
