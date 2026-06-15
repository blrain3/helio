import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { ConfigService } from '@nestjs/config';

/**
 * 领域事件发布器（BullMQ 生产者侧）。
 *
 * 只负责把领域事件入队，不消费。worker 进程（apps/worker）负责消费。
 *
 * 幂等策略（对应方案 C9）：
 * - 以业务 ID 作为 jobId（如 settlement-{orderId}），重复入队同一 jobId 不会重复执行；
 * - 注意：BullMQ jobId 不允许包含冒号 `:`，幂等键务必使用 `-` / `.` 等安全分隔符；
 * - 配合数据库唯一索引兜底，防止 worker 崩溃重启后重复执行。
 */

/** 队列名枚举，与 worker 进程保持一致。 */
export const QUEUES = {
  SETTLEMENT: 'settlement',
  STATISTICS: 'statistics',
  RECONCILIATION: 'reconciliation',
  ANOMALY: 'anomaly',
  PAYMENT: 'payment',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** 领域事件名（用于路由到具体队列 + 标识任务类型）。 */
export type DomainEventName =
  | 'PaymentSucceeded'
  | 'SettlementRequested'
  | 'StatisticsRefresh'
  | 'DailyReconciliation'
  | 'AnomalyDetection'
  | 'PaymentTimeoutClose';

export interface DomainEvent<T = Record<string, unknown>> {
  /** 事件名，worker 据此路由到具体处理器。 */
  name: DomainEventName;
  /** 事件负载。 */
  payload: T;
  /** 业务幂等键（作为 BullMQ jobId）。 */
  idempotencyKey: string;
}

@Injectable()
export class EventPublisher implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue>();

  constructor(private readonly config: ConfigService) {}

  /** 懒加载队列连接：首次入队时才建立 BullMQ Queue（避免启动即连 Redis）。 */
  private getQueue(name: QueueName): Queue {
    let q = this.queues.get(name);
    if (!q) {
      const connection = {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      };
      q = new Queue(name, { connection });
      this.queues.set(name, q);
    }
    return q;
  }

  /**
   * 发布领域事件到指定队列。
   * @param queue 目标队列
   * @param event 领域事件
   * @param opts 额外任务选项（重试/退避等，默认开启幂等 + 指数退避）
   */
  async publish<T>(
    queue: QueueName,
    event: DomainEvent<T>,
    opts?: JobsOptions,
  ): Promise<void> {
    const q = this.getQueue(queue);
    await q.add(
      event.name,
      { name: event.name, payload: event.payload },
      {
        // 幂等：以业务键作为 jobId，重复入队仅执行一次
        jobId: event.idempotencyKey,
        // 默认重试策略：最多 3 次，指数退避
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
        ...opts,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    const closers = Array.from(this.queues.values()).map((q) => q.close());
    await Promise.all(closers);
  }
}
