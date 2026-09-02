/**
 * 领域异常类型。
 *
 * 业务层通过抛出这些异常来表达语义化的失败，由全局异常过滤器（见 app 层）
 * 统一映射为 HTTP 状态码与标准错误响应体，避免业务逻辑直接耦合 HTTP 层。
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 认证失败：凭据错误、令牌无效或过期。 */
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
}

/** 已认证但权限不足（RBAC 拒绝）。 */
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

/** 资源冲突（如邮箱已注册、唯一约束冲突）。 */
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

/** 目标资源不存在。 */
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

/** 输入非法（业务校验失败，区别于 DTO 的框架级校验）。 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}
