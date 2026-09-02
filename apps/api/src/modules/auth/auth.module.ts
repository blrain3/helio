import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './presentation/auth.controller';
import { AuthService } from './application/auth.service';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { PasswordService } from './infrastructure/password.service';
import { RefreshTokenRepository } from './infrastructure/refresh-token.repository';
import { UserRepository } from '../user/infrastructure/user.repository';

/**
 * 认证模块：JWT 双令牌、Refresh Token Rotation、登录注册、登出。
 * 依赖 UserModule 暴露的 UserRepository（通过 PrismaService 访问）。
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokenService,
    PasswordService,
    RefreshTokenRepository,
    UserRepository,
  ],
  exports: [AuthService, JwtTokenService],
})
export class AuthModule {}
