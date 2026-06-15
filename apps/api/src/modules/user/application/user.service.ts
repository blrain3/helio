import { Injectable } from '@nestjs/common';
import { UserRepository } from '../infrastructure/user.repository';
import { UserEntity } from '../../auth/domain/user.entity';
import { Role } from '../../auth/domain/role.enum';
import { NotFoundError } from '../../auth/domain/errors';

/**
 * 用户管理应用服务：面向管理端的用户查询、角色调整与删除。
 * 创建用户（管理员建号）复用 AuthService.createUserByAdmin，保证密码散列逻辑唯一。
 */
@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }
    return user;
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
