import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  IsIn,
} from 'class-validator';
import { Role } from '../../domain/role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: '邮箱' })
  @IsEmail({}, { message: '邮箱格式不合法' })
  email!: string;

  @ApiProperty({ example: 'Str0ng!Pass', description: '密码（8–64 位）' })
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;

  @ApiProperty({
    example: 'web:chrome:abc123',
    description: '设备标识，用于按设备管理刷新令牌',
    required: false,
  })
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: '邮箱格式不合法' })
  email!: string;

  @ApiProperty({ example: 'Str0ng!Pass' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: 'web:chrome:abc123', description: '设备标识' })
  @IsString()
  @MinLength(1)
  deviceId!: string;
}

export class RefreshDto {
  @ApiProperty({ description: 'refresh token 原文' })
  @IsString()
  @MinLength(1)
  refreshToken!: string;

  @ApiProperty({ description: '设备标识，须与签发时一致' })
  @IsString()
  @MinLength(1)
  deviceId!: string;
}

export class LogoutDto {
  @ApiProperty({ description: '设备标识', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class AdminCreateUserDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail({}, { message: '邮箱格式不合法' })
  email!: string;

  @ApiProperty({ example: 'Str0ng!Pass' })
  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string;

  @ApiProperty({
    enum: Role,
    required: false,
    default: Role.USER,
    description: '角色（仅管理员可指定）',
  })
  @IsIn(Object.values(Role), { message: '非法角色' })
  @IsOptional()
  role?: Role;
}
