/**
 * RefreshToken 领域实体。
 *
 * 仅持久化 token 的哈希值（而非原文），支持 Refresh Token Rotation：
 * 每次刷新后旧令牌作废（revokedAt 置位），并可按设备（deviceId）整体撤销。
 */
export interface RefreshTokenEntity {
  id: string;
  /** 令牌原文的 SHA-256 哈希，作为唯一索引用于查找与防重放。 */
  hash: string;
  userId: string;
  deviceId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
