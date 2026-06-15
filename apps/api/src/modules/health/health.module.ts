import { Global, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RedisHealthModule } from '../../infrastructure/redis/redis-health.module';

/**
 * 健康检查模块（综合探针：db + redis）。
 * 全局模块以便在其他模块复用 CheckResult 类型（暂无，未来扩展）。
 */
@Global()
@Module({
  imports: [RedisHealthModule],
  controllers: [HealthController],
})
export class HealthModule {}