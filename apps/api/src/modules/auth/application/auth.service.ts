import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../user/infrastructure/user.repository';
import { RefreshTokenRepository } from '../infrastructure/refresh-token.repository';
import { JwtTokenService } from '../infrastructure/jwt-token.service';
import { PasswordService } from '../infrastructure/password.service';
import { TokenPair } from '../domain/token.types';
import { UserEntity } from '../domain/user.entity';
import { Role } from '../domain/role.enum';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../domain/errors';

export interface RegisterResult {
  user: UserEntity;
  tokens: TokenPair;
}

/**
 * 认证应用服务：编排注册、登录、刷新、登出、撤销等用例。
 *
 * 职责边界：本层只做业务编排与语义校验，持久化与令牌签发分别下沉到
 * infrastructure 层，HTTP 细节由 controller 层处理。
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtTokenService,
    private readonly passwords: PasswordService,
  ) {}

  /** 用户注册：校验邮箱唯一 → 散列密码 → 建号 → 签发令牌对。 */
  async register(
    email: string,
    password: string,
    deviceId?: string,
  ): Promise<RegisterResult> {
    const normalized = this.normalizeEmail(email);
    if (await this.users.existsByEmail(normalized)) {
      throw new ConflictError('该邮箱已被注册');
    }

    const passwordHash = await this.passwords.hash(password);
    const user = await this.users.create({ email: normalized, password }, passwordHash);
    // 注册时若未提供设备标识，使用默认值（注册后自动登录的会话设备）。
    const tokens = await this.issueTokenPair(user, deviceId ?? 'default');
    return { user, tokens };
  }

  /** 用户登录：校验凭据 → 签发令牌对。 */
  async login(
    email: string,
    password: string,
    deviceId: string,
  ): Promise<{ user: UserEntity; tokens: TokenPair }> {
    const normalized = this.normalizeEmail(email);
    const hash = await this.users.findPasswordHashByEmail(normalized);
    if (!hash || !(await this.passwords.verify(password, hash))) {
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const user = await this.users.findByEmail(normalized);
    if (!user) {
      // 理论上不可达（密码哈希存在则用户必存在），防御性兜底。
      throw new UnauthorizedError('邮箱或密码错误');
    }

    const tokens = await this.issueTokenPair(user, deviceId);
    return { user, tokens };
  }

  /**
   * 刷新令牌（Refresh Token Rotation）：
   * 1. 校验 refresh token 签名与有效期；
   * 2. 用哈希精确匹配持久化记录（未撤销、未过期）；
   * 3. 撤销旧令牌；
   * 4. 签发全新令牌对。
   * 任一环节失败即抛 Unauthorized，保证「一次令牌只可用一次」。
   */
  async refresh(refreshToken: string, deviceId: string): Promise<TokenPair> {
    const payload = this.jwt.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new UnauthorizedError('刷新令牌无效或已过期');
    }

    const hash = this.jwt.hashToken(refreshToken);
    const stored = await this.refreshTokens.findActiveByHash(hash);
    if (!stored || stored.userId !== payload.sub || stored.deviceId !== deviceId) {
      throw new UnauthorizedError('刷新令牌无效或已过期');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedError('用户不存在');
    }

    // 旧令牌作废，再签发新对（Rotation）。
    await this.refreshTokens.revoke(hash);
    return this.issueTokenPair(user, deviceId);
  }

  /** 登出：撤销指定设备上的全部有效令牌。 */
  async logout(userId: string, deviceId: string): Promise<void> {
    await this.refreshTokens.revokeByDevice(userId, deviceId);
  }

  /** 全端登出：撤销该用户全部有效令牌。 */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  /** 查询当前用户信息。 */
  async getMe(userId: string): Promise<UserEntity> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    return user;
  }

  /**
   * 管理员建号：可指定角色（默认 USER）。
   * 出于安全，注册入口不允许自设角色，只有该用例允许。
   */
  async createUserByAdmin(
    email: string,
    password: string,
    role?: Role,
  ): Promise<UserEntity> {
    const normalized = this.normalizeEmail(email);
    if (await this.users.existsByEmail(normalized)) {
      throw new ConflictError('该邮箱已被注册');
    }
    if (role && !Object.values(Role).includes(role)) {
      throw new ValidationError('非法角色');
    }
    const passwordHash = await this.passwords.hash(password);
    return this.users.create(
      { email: normalized, password, role },
      passwordHash,
    );
  }

  private async issueTokenPair(user: UserEntity, deviceId: string): Promise<TokenPair> {
    const refresh = this.jwt.signRefreshToken(user, deviceId);
    await this.refreshTokens.create({
      hash: refresh.hash,
      userId: user.id,
      deviceId,
      expiresAt: this.computeRefreshExpiry(),
    });

    const accessToken = this.jwt.signAccessToken(user);
    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.jwt.getAccessTtlSeconds(),
      tokenType: 'Bearer',
    };
  }

  private computeRefreshExpiry(): Date {
    // 与 refresh token 的 TTL 对齐（默认 30d），此处取 30 天。
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
