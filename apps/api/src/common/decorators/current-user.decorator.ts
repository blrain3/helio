import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../../modules/auth/domain/user.entity';

/**
 * 从请求上下文提取已认证用户（AuthUser）。
 * 依赖 JwtAuthGuard 先完成鉴权并挂载到 request.user。
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
