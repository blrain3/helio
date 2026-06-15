import { Module } from '@nestjs/common';
import { UserController } from './presentation/user.controller';
import { UserService } from './application/user.service';
import { UserRepository } from './infrastructure/user.repository';
import { AuthModule } from '../auth/auth.module';

/**
 * 用户管理模块：用户查询、角色调整、删除。
 * 建号能力复用 AuthModule 的 AuthService（保证密码散列逻辑唯一）。
 */
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
