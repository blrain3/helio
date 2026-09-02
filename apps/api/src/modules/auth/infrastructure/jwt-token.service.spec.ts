import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JwtTokenService } from './jwt-token.service';
import { UserEntity } from '../domain/user.entity';
import { Role } from '../domain/role.enum';

describe('JwtTokenService', () => {
  let service: JwtTokenService;
  const user: UserEntity = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'USER' as Role,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJwt = {
    sign: vi.fn((payload: unknown) => JSON.stringify(payload)),
    verify: vi.fn((token: string) => JSON.parse(token)),
  };

  beforeEach(() => {
    mockJwt.sign.mockClear();
    mockJwt.verify.mockClear();
    process.env.JWT_ACCESS_SECRET = 'access-secret';
    process.env.JWT_REFRESH_SECRET = 'refresh-secret';
    process.env.JWT_ACCESS_TTL = '15m';
    process.env.JWT_REFRESH_TTL = '30d';
    service = new JwtTokenService(mockJwt as never);
  });

  it('签发 access token 并携带用户主体', () => {
    const token = service.signAccessToken(user);
    expect(token).toBeTruthy();
    expect(mockJwt.sign).toHaveBeenCalled();
  });

  it('签发 refresh token 返回原文与哈希', () => {
    const { token, jti, hash } = service.signRefreshToken(user, 'device-1');
    expect(token).toBeTruthy();
    expect(jti).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(token);
  });

  it('hashToken 使用 SHA-256 且长度固定', () => {
    const hash = service.hashToken('abc');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(service.hashToken('abc'));
    expect(hash).not.toBe(service.hashToken('abd'));
  });

  it('getAccessTtlSeconds 解析 TTL 为秒', () => {
    expect(service.getAccessTtlSeconds()).toBe(15 * 60);
  });

  it('缺少 JWT 密钥时构造函数抛错（fail-fast）', () => {
    delete process.env.JWT_ACCESS_SECRET;
    expect(() => new JwtTokenService(mockJwt as never)).toThrow(
      /缺少必需环境变量：JWT_ACCESS_SECRET/,
    );
  });
});
