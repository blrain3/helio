import { PrismaClient } from '@prisma/client';

/**
 * 异常检测任务处理器。
 *
 * 职责：对指定电站的时序数据执行异常检测（规则引擎 + 滚动统计 + z-score）。
 * 检测引擎在 api 侧实现（modules/anomaly），worker 通过任务触发。
 *
 * M5 阶段：占位处理器，实际检测逻辑由 api 的 AnomalyService 提供，
 * 通过 HTTP 调用或共享包复用（M5b 完成后打通）。
 */
export async function handleAnomaly(
  payload: Record<string, unknown>,
  _prisma: PrismaClient,
): Promise<void> {
  const plantId = payload.plantId as string;
  if (!plantId) {
    throw new Error('异常检测任务缺少 plantId');
  }
  // 占位：实际检测由 api AnomalyService 执行。
}
