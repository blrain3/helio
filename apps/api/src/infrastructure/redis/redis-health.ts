import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect as netConnect, Socket } from 'node:net';

/**
 * Redis 健康探针（零新依赖，复用 node:net 发起 TCP 连接）。
 *
 * 设计取舍：
 * - 不引入 ioredis / node-redis，理由：健康检查只需「端口可达」信号，
 *   协议级 PING 可在未来按需升级为 raw RESP PING，但当前开销/价值不匹配。
 * - 1 秒连接超时（可配 REDIS_HEALTH_TIMEOUT_MS），超时即视为不健康，
 *   编排系统据此摘流。
 */
@Injectable()
export class RedisHealth {
  private readonly logger = new Logger(RedisHealth.name);

  constructor(private readonly config: ConfigService) {}

  async check(): Promise<RedisCheckResult> {
    const host = this.config.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.config.get<number>('REDIS_PORT', 6379));
    const timeoutMs = Number(this.config.get<number>('REDIS_HEALTH_TIMEOUT_MS', 1000));

    const started = Date.now();
    return new Promise<RedisCheckResult>((resolve) => {
      const socket: Socket = netConnect({ host, port });
      let settled = false;

      const finish = (ok: boolean, error?: string): void => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve({ ok, latencyMs: Date.now() - started, error });
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => {
        finish(false, `timeout after ${timeoutMs}ms`);
      });
      socket.once('error', (err) => {
        this.logger.warn(`redis health probe error: ${err.message}`);
        finish(false, err.message);
      });
    });
  }
}

export interface RedisCheckResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}