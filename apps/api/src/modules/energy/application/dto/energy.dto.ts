import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  IsIn,
  Min,
  IsDateString,
} from 'class-validator';
import { DeviceType } from '../../domain/energy.entity';

export class CreatePlantDto {
  @ApiProperty({ example: '屋顶电站 A', description: '电站名称' })
  @IsString()
  @MinLength(1, { message: '电站名称不能为空' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 10.5, description: '装机容量（kW）' })
  @IsNumber()
  @Min(0, { message: '装机容量不能为负' })
  capacity!: number;

  @ApiPropertyOptional({ example: '上海市浦东新区', description: '安装地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}

export class UpdatePlantDto {
  @ApiPropertyOptional({ description: '电站名称' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '装机容量（kW）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: '安装地址' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}

export class CreateDeviceDto {
  @ApiProperty({ example: 'SN-0001', description: '设备序列号（唯一）' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  serialNo!: string;

  @ApiPropertyOptional({ example: '逆变器 #1', description: '设备名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    enum: ['INVERTER', 'METER', 'SENSOR', 'BATTERY', 'OTHER'],
    default: 'INVERTER',
    description: '设备类型',
  })
  @IsOptional()
  @IsIn(['INVERTER', 'METER', 'SENSOR', 'BATTERY', 'OTHER'], {
    message: '非法设备类型',
  })
  type?: DeviceType;

  @ApiProperty({ description: '所属电站 id' })
  @IsUUID()
  plantId!: string;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional({ description: '设备名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    enum: ['INVERTER', 'METER', 'SENSOR', 'BATTERY', 'OTHER'],
    description: '设备类型',
  })
  @IsOptional()
  @IsIn(['INVERTER', 'METER', 'SENSOR', 'BATTERY', 'OTHER'])
  type?: DeviceType;
}

export class CreateTariffDto {
  @ApiProperty({ example: 65, description: '单价（分 / billingUnit）' })
  @IsNumber()
  @Min(0, { message: '单价不能为负' })
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'CNY', description: '币种' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ example: 'kWh', description: '计费单位' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  billingUnit?: string;

  @ApiProperty({ example: '2026-09-01T00:00:00Z', description: '生效时间' })
  @IsDateString()
  effectiveAt!: string;
}

export class CreateEnergyRecordDto {
  @ApiProperty({ description: '设备 id' })
  @IsUUID()
  deviceId!: string;

  @ApiProperty({ description: '电站 id' })
  @IsUUID()
  plantId!: string;

  @ApiProperty({ example: 12.345, description: '发电量（kWh）' })
  @IsNumber()
  @Min(0, { message: '发电量不能为负' })
  generationKwh!: number;

  @ApiPropertyOptional({
    description: '计量时间戳（ISO 8601），缺省为当前时间',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}
