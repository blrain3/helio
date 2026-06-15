import { PrismaClient } from '@prisma/client';

/**
 * 每日对账任务处理器（DailyReconciliation 消费者）。
 *
 * 职责：触发 api 进程执行某日的对账（本地支付流水 ↔ 渠道对账单）。
 * 对账匹配逻辑与渠道对账单下载由 api 的 ReconciliationService 提供，
 * 本 worker 仅作「定时触发 + HTTP 调用」（进程解耦），避免跨包引用 Nest DI。
 *
 * 调用 api 的内部对账端点，凭 x-internal-token（RECONCILE_INTERNAL_TOKEN）鉴权。
 */
export async function handleReconciliation(
  payload: Record<string, unknown>,
  _prisma: PrismaClient,
): Promise<void> {
  // 日对账默认核对「前一日」的已结清流水。
  const date = (payload.date as string) ?? yesterdayIso();
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  const token = process.env.RECONCILE_INTERNAL_TOKEN ?? 'helio-internal';

  const res = await fetch(`${baseUrl}/payments/reconcile/daily/internal`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': token,
    },
    body: JSON.stringify({ date }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`日对账触发失败: HTTP ${res.status} ${body}`);
  }
}

/** 昨日日期（YYYY-MM-DD，本地时区）。 */
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
