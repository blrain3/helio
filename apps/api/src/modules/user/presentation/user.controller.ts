import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../application/user.service';
import { AuthService } from '../../auth/application/auth.service';
import { UpdateUserRoleDto } from '../application/dto/user.dto';
import { AdminCreateUserDto } from '../../auth/application/dto/auth.dto';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../auth/domain/role.enum';
import { UserEntity } from '../../auth/domain/user.entity';

@ApiTags('user')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly auth: AuthService,
  ) {}

  @Get(':id')
  @ApiOperation({ summary: '按 id 查询用户' })
  @ApiResponse({ status: 200, type: Object, description: '用户信息' })
  async findById(@Param('id') id: string): Promise<UserEntity> {
    return this.users.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '管理员创建用户（可指定角色）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async create(@Body() dto: AdminCreateUserDto): Promise<UserEntity> {
    return this.auth.createUserByAdmin(dto.email, dto.password, dto.role);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '调整用户角色' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 403, description: '权限不足' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
  ): Promise<UserEntity> {
    return this.users.updateRole(id, dto.role);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除用户' })
  @ApiResponse({ status: 204, description: '删除成功' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.users.remove(id);
  }
}
