import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtTokenService } from '../../modules/auth/infrastructure/jwt-token.service';
import { AuthUser } from '../../modules/auth/domain/user.entity';

/**
 * JWT 认证守卫：从 Authorization: Bearer <token> 解析 access token，
 * 校验通过后把 AuthUser 挂载到 request.user。
 *
 * 与 @Public() 装饰器配合：标记为 public 的端点跳过鉴权。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtTokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('缺少访问令牌');
    }

    const user = this.jwt.verifyAccessToken(token);
    if (!user) {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }

    request.user = user as AuthUser;
    return true;
  }

  private extractToken(request: { headers?: Record<string, unknown> }): string | null {
    const header = request.headers?.authorization;
    if (typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
  }
}

export const IS_PUBLIC_KEY = 'isPublic';
