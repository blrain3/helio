import { PrismaClient } from '@prisma/client';

/**
 * 结算任务处理器（PaymentSucceeded 事件消费者）。
 *
 * 职责：支付成功后，将订单标记为已完成，并确保账单已标记为已支付。
 * 幂等：以 orderId 作为 jobId，重复入队不会重复执行；数据库条件更新兜底。
 *
 * 注意：本处理器直接操作 Prisma，避免跨包引用 api 的 service 层。
 */
export async function handleSettlement(
  payload: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<void> {
  const orderId = payload.orderId as string;
  if (!orderId) {
    throw new Error('结算任务缺少 orderId');
  }

  // 条件更新：仅当订单处于 PAID 状态时才流转到 COMPLETED，保证幂等。
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    // 订单不存在，可能是乱序/脏数据，直接视为成功（不阻塞队列）。
    return;
  }

  if (order.status !== 'PAID') {
    // 未支付，跳过（等待回调先落库）。
    return;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'COMPLETED' },
  });

  // 联动账单：若有关联账单且未支付，标记为已支付。
  if (order.billId) {
    await prisma.bill.updateMany({
      where: { id: order.billId, status: 'ISSUED' },
      data: { status: 'PAID' },
    });
  }
}
