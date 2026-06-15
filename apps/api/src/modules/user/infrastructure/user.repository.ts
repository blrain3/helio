import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { UserEntity, CreateUserInput } from '../../auth/domain/user.entity';
import { Role } from '../../auth/domain/role.enum';

/**
 * 用户仓储：封装 User 表的持久化访问，将 Prisma 模型映射为领域实体。
 *
 * 注意：对外返回的 UserEntity 不包含 passwordHash，密码散列仅在
 * 认证内部通过专用的密码服务读写。
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toEntity(user) : null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toEntity(user) : null;
  }

  /**
   * 创建用户。返回带密码散列的完整行（供注册流程内部使用），
   * 由调用方负责剥离敏感字段后再对外暴露。
   */
  async create(input: CreateUserInput, passwordHash: string): Promise<UserEntity> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: input.role ?? Role.USER,
      },
    });
    return this.toEntity(user);
  }

  /**
   * 仅用于认证内部：读取密码散列。
   */
  async findPasswordHashByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });
    return user?.passwordHash ?? null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  async updateRole(id: string, role: Role): Promise<UserEntity | null> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { role },
    });
    return this.toEntity(user);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  private toEntity(
    user: { id: string; email: string; role: Role; createdAt: Date; updatedAt: Date },
  ): UserEntity {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
