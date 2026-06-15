import { Module } from '@nestjs/common';
import { RedisHealth } from './redis-health';

/** Redis 健康探针模块（仅暴露 RedisHealth 服务，供 HealthController 注入）。 */
@Module({
  providers: [RedisHealth],
  exports: [RedisHealth],
})
export class RedisHealthModule {}