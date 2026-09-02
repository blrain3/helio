import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { Role } from '../domain/role.enum';
import { UserEntity } from '../domain/user.entity';
import { ConflictError, UnauthorizedError } from '../domain/errors';

describe('AuthService', () => {
  const user: UserEntity = {
    id: 'user-1',
    email: 'user@example.com',
    role: Role.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const makeDeps = () => ({
    users: {
      existsByEmail: vi.fn(),
      create: vi.fn(),
      findPasswordHashByEmail: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
    },
    refreshTokens: {
      create: vi.fn(),
      findActiveByHash: vi.fn(),
      revoke: vi.fn(),
      revokeByDevice: vi.fn(),
      revokeAllForUser: vi.fn(),
    },
    jwt: {
      signAccessToken: vi.fn(() => 'access-token'),
      signRefreshToken: vi.fn(() => ({
        token: 'refresh-token',
        jti: 'jti-1',
        hash: 'hash-1',
      })),
      verifyRefreshToken: vi.fn(),
      verifyAccessToken: vi.fn(),
      hashToken: vi.fn((t: string) => `hash(${t})`),
      getAccessTtlSeconds: vi.fn(() => 900),
    },
    passwords: {
      hash: vi.fn(() => Promise.resolve('hashed')),
      verify: vi.fn(),
    },
  });

  let deps: ReturnType<typeof makeDeps>;
  let service: AuthService;

  beforeEach(() => {
    deps = makeDeps();
    service = new AuthService(
      deps.users as never,
      deps.refreshTokens as never,
      deps.jwt as never,
      deps.passwords as never,
    );
  });

  it('注册成功：邮箱唯一校验通过后创建用户并签发令牌', async () => {
    deps.users.existsByEmail.mockResolvedValue(false);
    deps.users.create.mockResolvedValue(user);

    const result = await service.register('User@Example.com ', 'password123', 'device-1');

    expect(deps.users.create).toHaveBeenCalled();
    // 邮箱应被归一化（trim + lower）
    const createArg = deps.users.create.mock.calls[0]?.[0];
    expect(createArg.email).toBe('user@example.com');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('注册失败：邮箱已存在时抛 ConflictError', async () => {
    deps.users.existsByEmail.mockResolvedValue(true);
    await expect(
      service.register('user@example.com', 'password123', 'device-1'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('登录成功：密码校验通过后返回用户与令牌', async () => {
    deps.users.findPasswordHashByEmail.mockResolvedValue('hashed');
    deps.passwords.verify.mockResolvedValue(true);
    deps.users.findByEmail.mockResolvedValue(user);

    const result = await service.login('user@example.com', 'password123', 'device-1');
    expect(result.user.id).toBe('user-1');
    expect(result.tokens.accessToken).toBe('access-token');
  });

  it('登录失败：密码错误抛 UnauthorizedError', async () => {
    deps.users.findPasswordHashByEmail.mockResolvedValue('hashed');
    deps.passwords.verify.mockResolvedValue(false);

    await expect(
      service.login('user@example.com', 'wrong', 'device-1'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('刷新：旧令牌撤销并签发新令牌（Rotation）', async () => {
    deps.jwt.verifyRefreshToken.mockReturnValue({
      sub: 'user-1',
      jti: 'jti-1',
      deviceId: 'device-1',
    });
    deps.refreshTokens.findActiveByHash.mockResolvedValue({
      id: 'rt-1',
      hash: 'hash-1',
      userId: 'user-1',
      deviceId: 'device-1',
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      createdAt: new Date(),
    });
    deps.users.findById.mockResolvedValue(user);

    const tokens = await service.refresh('refresh-token', 'device-1');

    expect(deps.refreshTokens.revoke).toHaveBeenCalledWith('hash(refresh-token)');
    expect(tokens.accessToken).toBe('access-token');
  });

  it('刷新失败：令牌已撤销或过期抛 UnauthorizedError', async () => {
    deps.jwt.verifyRefreshToken.mockReturnValue({
      sub: 'user-1',
      jti: 'jti-1',
      deviceId: 'device-1',
    });
    deps.refreshTokens.findActiveByHash.mockResolvedValue(null);

    await expect(
      service.refresh('refresh-token', 'device-1'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
