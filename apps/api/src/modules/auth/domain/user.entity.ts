import { Role } from './role.enum';

/**
 * User 领域实体。
 *
 * 对外暴露的是不含密码散列的「安全投影」：密码散列由 infrastructure 层负责，
 * 领域层不直接持有 `passwordHash`，避免误将敏感字段泄漏到业务层之外。
 */
export interface UserEntity {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 认证上下文中的用户主体（由 JWT payload 解出）。
 * 该结构被注入到请求上下文，供 RBAC 守卫与业务层使用。
 */
export interface AuthUser {
  sub: string; // 用户 id
  email: string;
  role: Role;
  /** JWT 令牌 id，用于 refresh rotation 时的精确校验。 */
  jti?: string;
}

/**
 * 创建用户所需的输入（注册/管理员建号）。
 */
export interface CreateUserInput {
  email: string;
  password: string;
  role?: Role;
}
