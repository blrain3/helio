import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Role } from '../../../auth/domain/role.enum';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, description: '目标角色' })
  @IsIn(Object.values(Role), { message: '非法角色' })
  role!: Role;
}
