import { Global, Module } from '@nestjs/common';
import { EventPublisher } from './event-publisher';

/**
 * 全局队列模块：提供 BullMQ 生产者侧能力。
 *
 * 职责边界（与 worker 进程解耦）：
 * - api 进程：只负责「入队」（EventPublisher.publish），不消费；
 * - worker 进程：独立进程消费队列（见 apps/worker/src/main.ts）。
 *
 * 领域事件仅用于核心异步解耦链路（支付成功 → 结算/统计），
 * 不做全面 Event-driven。
 */
@Global()
@Module({
  providers: [EventPublisher],
  exports: [EventPublisher],
})
export class QueueModule {}
