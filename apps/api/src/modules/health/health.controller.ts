import { Controller, Get, HttpCode, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisHealth } from '../../infrastructure/redis/redis-health';

/**
 * 健康检查端点（零新依赖，复用现有 Prisma + 节点 net TCP 探活）。
 *
 * 端点：
 * - GET /api/health         综合探针（db + redis），任一失败返回 503
 * - GET /api/health/live    liveness：进程存活（不依赖外部）
 * - GET /api/health/ready   readiness：与 /health 等价，语义面向 K8s
 *
 * 注：redis 探针使用 TCP 端口可达性而非 PING 协议，原因是零依赖且足够表达
 * 「redis 进程是否在响应」。若后续需要协议级断言，可在此处替换为 PING。
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealth,
  ) {}

  @Get()
  async health(): Promise<HealthReport> {
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.redisHealth.check(),
    ]);
    const ok = db.ok && redis.ok;
    if (!ok) {
      // 503 + details 由 GlobalExceptionFilter 透传
      throw new ServiceUnavailableException({
        message: 'health check unavailable',
        details: { db, redis },
      });
    }
    return { status: 'ok', db, redis };
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok' } {
    // 进程存活，不依赖任何外部。
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<HealthReport> {
    // readiness 语义：所有依赖就绪才接收流量。
    return this.health();
  }

  private async checkDb(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      this.logger.error(`db health check failed: ${(err as Error).message}`);
      return { ok: false, latencyMs: Date.now() - started, error: (err as Error).message };
    }
  }
}

export interface CheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface HealthReport {
  status: 'ok' | 'unavailable';
  db: CheckResult;
  redis: CheckResult;
}