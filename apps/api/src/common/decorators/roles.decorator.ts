import { SetMetadata } from '@nestjs/common';
import { Role } from '../../modules/auth/domain/role.enum';

export const ROLES_KEY = 'roles';

/**
 * 角色约束装饰器：标注某个端点/控制器所需的角色集合。
 * 搭配 RolesGuard 使用。未标注时默认仅要求「已登录」。
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
