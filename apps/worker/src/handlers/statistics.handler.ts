import { PrismaClient } from '@prisma/client';

/**
 * 统计刷新任务处理器。
 *
 * 职责：支付/能源数据变更后，刷新物化视图（日/月发电量统计）。
 * 当前实现为占位：M5 阶段先打通任务链路，物化视图刷新策略在 M6 性能里程碑细化。
 */
export async function handleStatistics(
  _payload: Record<string, unknown>,
  prisma: PrismaClient,
): Promise<void> {
  // 刷新日统计物化视图（若存在）。REFRESH CONCURRENTLY 需物化视图有唯一索引。
  try {
    await prisma.$executeRawUnsafe(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY generation_daily_stat`,
    );
  } catch {
    // 物化视图可能尚未创建，忽略（worker 启动时由 time-series.sql 初始化）。
  }
}
