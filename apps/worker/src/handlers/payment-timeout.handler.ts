import { PrismaClient } from '@prisma/client';

/**
 * 支付超时关单任务处理器（PaymentTimeoutClose 事件消费者）。
 *
 * 职责：支付创建后，若在超时窗口内未收到成功回调，到期自动关闭
 *   —— Payment PENDING→CLOSED + Order PENDING_PAYMENT→CLOSED。
 *
 * 幂等与安全（核心）：
 *   1. 以 paymentId 作为 jobId，重复入队仅执行一次；
 *   2. 数据库条件更新（updateMany + where status='PENDING'）作为最终守卫：
 *      即使延迟任务在用户完成支付（SUCCESS）之后才执行，也会因状态已非
 *      PENDING 而跳过，不会误关已支付的流水；
 *   3. 联动订单同样以 where status='PENDING_PAYMENT' 条件更新，避免覆盖并发
 *      成功支付造成的 PAID 状态。
 *
 * 边界说明：本处理器直接操作 Prisma（与 settlement 处理器一致），保持 worker
 * 进程与 api 进程解耦。真实渠道场景下「先查渠道再关单」的 queryPayment 兜底
 * 在 P2 灰度阶段于 api 侧补齐（worker 不持有网关实例）。
 */
export async function handlePaymentTimeoutClose(
  payload: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<void> {
  const paymentId = payload.paymentId as string;
  if (!paymentId) {
    throw new Error('关单任务缺少 paymentId');
  }
  const orderId = payload.orderId as string | undefined;

  // 条件更新：仅当支付仍处于 PENDING 时才关闭。
  const closed = await prisma.payment.updateMany({
    where: { id: paymentId, status: 'PENDING' },
    data: { status: 'CLOSED' },
  });

  if (closed.count === 0) {
    // 已非 PENDING（已成功/已关闭/已失败），跳过，幂等返回。
    return;
  }

  // 联动订单：PENDING_PAYMENT → CLOSED。
  if (orderId) {
    await prisma.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'CLOSED' },
    });
  }
}
