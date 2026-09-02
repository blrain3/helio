import { PrismaClient } from '@prisma/client';

/**
 * 每日对账任务处理器。
 *
 * 职责：触发某日的对账（本地支付流水 ↔ 渠道对账单）。
 * M5 阶段打通任务链路；对账匹配逻辑由 api 的 ReconciliationService 提供，
 * 此处通过 HTTP 调用 api 的对账端点（进程解耦），或后续直接内嵌。
 *
 * 当前为占位：记录任务接收，实际对账逻辑在 M4b 真实渠道接入后完善
 * （Mock 阶段对账单与本地一致，无差异可查）。
 */
export async function handleReconciliation(
  payload: Record<string, unknown>,
  _prisma: PrismaClient,
): Promise<void> {
  const date = (payload.date as string) ?? new Date().toISOString().slice(0, 10);
  // 占位：真实对账逻辑由 api 提供。此处仅确认任务链路可用。
  void date;
}
