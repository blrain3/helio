import 'dotenv/config';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { handleSettlement } from './handlers/settlement.handler';
import { handleStatistics } from './handlers/statistics.handler';
import { handleReconciliation } from './handlers/reconciliation.handler';
import { handleAnomaly } from './handlers/anomaly.handler';
import { handlePaymentTimeoutClose } from './handlers/payment-timeout.handler';

// Helio Worker 入口：注册 BullMQ 队列与消费者（与 api 进程解耦）。
// api 进程负责「入队」，本进程负责「消费」。

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

const prisma = new PrismaClient();

// 队列（生产者侧，供 worker 内部可能的重试/调度使用）。
export const settlementQueue = new Queue('settlement', { connection });
export const statisticsQueue = new Queue('statistics', { connection });
export const reconciliationQueue = new Queue('reconciliation', { connection });
export const anomalyQueue = new Queue('anomaly', { connection });
export const paymentQueue = new Queue('payment', { connection });

/** 处理器路由表：事件名 → 处理器。 */
type Handler = (payload: Record<string, unknown>, prisma: PrismaClient) => Promise<void>;

function createWorker(queueName: string, routes: Record<string, Handler>): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const name = job.data?.name as string;
      const payload = (job.data?.payload ?? {}) as Record<string, unknown>;
      const handler = routes[name];
      if (!handler) {
        // 未知事件名：视为成功（避免阻塞队列），记录日志。
        // eslint-disable-next-line no-console
        console.warn(`[Worker] 未知事件 ${name}，跳过`);
        return;
      }
      await handler(payload, prisma);
    },
    {
      connection,
      // 失败任务自动重试由 BullMQ attempts/backoff 控制（入队时设置）。
      // 超过 attempts 后进入 failed 集合（可人工重放）。
      concurrency: 4,
    },
  );

  worker.on('completed', (job) => {
    // eslint-disable-next-line no-console
    console.log(`[Worker] ${queueName} 完成: ${job.id} (${job.data?.name})`);
  });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[Worker] ${queueName} 失败: ${job?.id}`, err.message);
  });

  return worker;
}

// 消费者：按队列注册，事件名路由到具体处理器。
createWorker('settlement', {
  PaymentSucceeded: handleSettlement,
  SettlementRequested: handleSettlement,
});
createWorker('statistics', {
  StatisticsRefresh: handleStatistics,
});
createWorker('reconciliation', {
  DailyReconciliation: handleReconciliation,
});
createWorker('anomaly', {
  AnomalyDetection: handleAnomaly,
});
createWorker('payment', {
  PaymentTimeoutClose: handlePaymentTimeoutClose,
});

// eslint-disable-next-line no-console
console.log('[Helio Worker] queues & workers initialized');

// 优雅关闭。
async function shutdown(): Promise<void> {
  await prisma.$disconnect();
  await Promise.all([
    settlementQueue.close(),
    statisticsQueue.close(),
    reconciliationQueue.close(),
    anomalyQueue.close(),
    paymentQueue.close(),
  ]);
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
