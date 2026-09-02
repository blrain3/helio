import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLE_WEIGHT } from '../../modules/auth/domain/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../../modules/auth/domain/user.entity';

/**
 * RBAC 守卫：校验当前用户的角色是否满足端点声明的角色要求。
 *
 * 判定规则：用户角色权重 >= 所需角色中最低权重即放行。
 * 未声明 @Roles 的端点不限制角色（但仍需已登录，由 JwtAuthGuard 保证）。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('未认证');
    }

    const userWeight = ROLE_WEIGHT[user.role];
    const allowed = required.some((r) => userWeight >= ROLE_WEIGHT[r]);
    if (!allowed) {
      throw new ForbiddenException('权限不足');
    }
    return true;
  }
}
