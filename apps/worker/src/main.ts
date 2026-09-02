import 'dotenv/config';
import { Queue } from 'bullmq';

// Helio Worker 入口：注册 BullMQ 队列与消费者
// 与 api 共用业务代码，仅作为独立进程运行任务消费

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

// 核心队列（M4–M5 逐步接入消费者）：
// - settlement：结算 / 生成账单
// - statistics：更新统计
// - reconciliation：每日对账
// - anomaly：异常检测
export const settlementQueue = new Queue('settlement', { connection });
export const statisticsQueue = new Queue('statistics', { connection });
export const reconciliationQueue = new Queue('reconciliation', { connection });
export const anomalyQueue = new Queue('anomaly', { connection });

// eslint-disable-next-line no-console
console.log('[Helio Worker] queues initialized');
