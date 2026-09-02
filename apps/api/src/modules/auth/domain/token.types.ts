import { AuthUser } from './user.entity';

/**
 * 令牌对（值对象）。
 * 登录 / 刷新成功后返回给客户端。
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** access token 过期秒数，供客户端设置缓存策略。 */
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * 令牌签发参数（infrastructure 层 JwtTokenService 的输入）。
 */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

/**
 * Refresh token 的声明载荷。
 */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  deviceId: string;
}

/**
 * 校验结果：成功时返回 AuthUser，失败时返回 null（由调用方决定是否抛 Unauthorized）。
 */
export type AccessTokenVerifyResult = AuthUser | null;
