import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../domain/token.types';
import { AuthUser, UserEntity } from '../domain/user.entity';

/**
 * JWT 令牌服务：负责 access / refresh 双令牌的签发与校验。
 *
 * 安全要点：
 * - access 与 refresh 使用独立密钥，避免任一密钥泄露导致全链路失守；
 * - refresh token 原文仅返回一次，落库前做 SHA-256 哈希；
 * - 每个令牌携带唯一 jti，支撑 refresh rotation 的精确匹配。
 */
@Injectable()
export class JwtTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(private readonly jwt: JwtService) {
    this.accessSecret = this.requireEnv('JWT_ACCESS_SECRET');
    this.refreshSecret = this.requireEnv('JWT_REFRESH_SECRET');
    this.accessTtl = process.env.JWT_ACCESS_TTL ?? '15m';
    this.refreshTtl = process.env.JWT_REFRESH_TTL ?? '30d';
  }

  /** 读取必需环境变量，缺失时立即抛错（fail-fast，避免带默认弱密钥上线）。 */
  private requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`缺少必需环境变量：${key}（请参考 apps/api/.env.example 配置）`);
    }
    return value;
  }

  /** 签发 access token，短时有效（默认 15m）。 */
  signAccessToken(user: UserEntity, jti: string = randomUUID()): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti,
    };
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessTtl,
    });
  }

  /**
   * 签发 refresh token，长时有效（默认 30d）。
   * 返回 { token, jti, hash }：token 原文返回给客户端，jti/hash 用于持久化与校验。
   */
  signRefreshToken(user: UserEntity, deviceId: string): {
    token: string;
    jti: string;
    hash: string;
  } {
    const jti = randomUUID();
    const payload: RefreshTokenPayload = { sub: user.id, jti, deviceId };
    const token = this.jwt.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl,
    });
    return { token, jti, hash: this.hashToken(token) };
  }

  /**
   * 校验 access token。
   * 成功返回 AuthUser；失败（过期 / 伪造 / 签名错误）返回 null。
   */
  verifyAccessToken(token: string): AuthUser | null {
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.accessSecret,
      });
      return { sub: payload.sub, email: payload.email, role: payload.role as AuthUser['role'], jti: payload.jti };
    } catch {
      return null;
    }
  }

  /**
   * 校验 refresh token 并返回声明（含 jti 与 deviceId）。
   * 过期或签名错误返回 null。
   */
  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      return this.jwt.verify<RefreshTokenPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      return null;
    }
  }

  /** 对 token 原文做 SHA-256，得到用于持久化的哈希值。 */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** access token 有效期（秒），供客户端设置缓存。 */
  getAccessTtlSeconds(): number {
    return this.parseTtlToSeconds(this.accessTtl);
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const factors: Record<'s' | 'm' | 'h' | 'd', number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * factors[unit];
  }
}
