import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/user.repository';
import { AuthUser, UserEntity } from '../../auth/domain/user.entity';
import { Role } from '../../auth/domain/role.enum';
import { ForbiddenError, NotFoundError } from '../../auth/domain/errors';

/**
 * 用户管理应用服务：面向管理端的用户查询、角色调整与删除。
 * 创建用户（管理员建号）复用 AuthService.createUserByAdmin，保证密码散列逻辑唯一。
 */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  async findById(id: string, user: AuthUser): Promise<UserEntity> {
    if (id !== user.sub && user.role !== Role.ADMIN) {
      throw new ForbiddenError('无权查询该用户');
    }
    const found = await this.users.findById(id);
    if (!found) {
      throw new NotFoundError('用户不存在');
    }
    return found;
  }

  async findByEmail(email: string): Promise<UserEntity> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    return user;
  }

  async updateRole(id: string, role: Role): Promise<UserEntity> {
    const user = await this.users.updateRole(id, role);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    return user;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.users.findById(id);
    if (!existing) {
      throw new NotFoundError('用户不存在');
    }
    await this.users.remove(id);
  }
}
