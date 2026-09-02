import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RefreshTokenEntity } from '../domain/refresh-token.entity';

/**
 * RefreshToken 仓储：持久化刷新令牌的哈希值，支撑 Rotation 与按设备撤销。
 *
 * 安全设计：
 * - 数据库仅存 token 原文的 SHA-256 哈希，泄漏数据库也无法直接使用令牌；
 * - `hash` 唯一，天然防重放（同一令牌二次使用即查不到）。
 */
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Pick<RefreshTokenEntity, 'hash' | 'userId' | 'deviceId' | 'expiresAt'>,
  ): Promise<RefreshTokenEntity> {
    const token = await this.prisma.refreshToken.create({
      data: {
        hash: data.hash,
        userId: data.userId,
        deviceId: data.deviceId,
        expiresAt: data.expiresAt,
      },
    });
    return this.toEntity(token);
  }

  /** 按哈希查找且必须「未撤销、未过期」，否则视为不存在（防重放）。 */
  async findActiveByHash(hash: string): Promise<RefreshTokenEntity | null> {
    const token = await this.prisma.refreshToken.findUnique({ where: { hash } });
    if (!token || token.revokedAt || token.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return this.toEntity(token);
  }

  /** 撤销单个令牌（Rotation 时调用）。 */
  async revoke(hash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** 撤销某用户在指定设备上的全部有效令牌（登出 / 设备下线）。 */
  async revokeByDevice(userId: string, deviceId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** 撤销某用户的全部有效令牌（全端登出 / 账号安全）。 */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toEntity(
    t: {
      id: string;
      hash: string;
      userId: string;
      deviceId: string;
      expiresAt: Date;
      revokedAt: Date | null;
      createdAt: Date;
    },
  ): RefreshTokenEntity {
    return {
      id: t.id,
      hash: t.hash,
      userId: t.userId,
      deviceId: t.deviceId,
      expiresAt: t.expiresAt,
      revokedAt: t.revokedAt,
      createdAt: t.createdAt,
    };
  }
}
