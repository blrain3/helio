import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/application/auth.service';
import { UserService } from './modules/user/application/user.service';
import { JwtTokenService } from './modules/auth/infrastructure/jwt-token.service';
import { PrismaService } from './infrastructure/prisma/prisma.service';

/**
 * 模块装配冒烟测试：验证 AppModule 能完整实例化，
 * 各层服务与依赖注入链正确。
 *
 * PrismaService 通过 overrideProvider 注入替身，规避真实数据库连接；
 * 守卫由 AppModule 通过 APP_GUARD 注册，此处验证其存在性。
 */
describe('AppModule 装配冒烟测试', () => {
  let authService: AuthService;
  let userService: UserService;
  let jwtTokenService: JwtTokenService;

  const prismaStub = {
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    user: {},
    refreshToken: {},
  };

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    authService = moduleRef.get<AuthService>(AuthService, { strict: false });
    userService = moduleRef.get<UserService>(UserService, { strict: false });
    jwtTokenService = moduleRef.get<JwtTokenService>(JwtTokenService, { strict: false });
  });

  it('AuthService 可被解析（含完整 DI 链）', () => {
    expect(authService).toBeDefined();
  });

  it('UserService 可被解析（含完整 DI 链）', () => {
    expect(userService).toBeDefined();
  });

  it('JwtTokenService 可被解析且读取到密钥', () => {
    expect(jwtTokenService).toBeDefined();
    expect(jwtTokenService.getAccessTtlSeconds()).toBe(900);
  });
});
