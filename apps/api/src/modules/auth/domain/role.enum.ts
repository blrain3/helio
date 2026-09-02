/**
 * 用户角色。
 *
 * 使用字符串字面量联合类型（而非 TypeScript enum），与 Prisma 生成的
 * `$Enums.Role` 天然兼容，同时保持 domain 层不依赖任何基础设施。
 *
 * 角色采用三级模型：
 * - USER：普通终端用户，可访问自身资源；
 * - OPERATOR：运维人员，可访问监控/运营类资源；
 * - ADMIN：管理员，拥有系统级管理权限（含用户管理）。
 */
export type Role = 'USER' | 'OPERATOR' | 'ADMIN';

/** 所有合法角色的常量数组，便于运行时遍历与校验。 */
export const ROLES: readonly Role[] = ['USER', 'OPERATOR', 'ADMIN'] as const;

/** 运行时角色常量，供需要对象形式引用的场景使用。 */
export const Role = {
  USER: 'USER',
  OPERATOR: 'OPERATOR',
  ADMIN: 'ADMIN',
} as const satisfies Record<Role, Role>;

/**
 * 角色优先级（数值越大权限越高）。
 * 用于 RBAC 守卫在需要「至少具备某角色」时做层级比较。
 */
export const ROLE_WEIGHT: Record<Role, number> = {
  USER: 1,
  OPERATOR: 2,
  ADMIN: 3,
};
