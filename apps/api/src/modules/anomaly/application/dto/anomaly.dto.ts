import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
  IsDateString,
  IsObject,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Severity } from '../../domain/anomaly.entity';

export class CreateAnomalyRuleDto {
  @ApiProperty({ example: '低发电量告警', description: '规则名称' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: '规则条件（阈值或突降，见 anomaly.entity.ts 的 RuleCondition）',
    example: { type: 'threshold', metric: 'generationKwh', operator: 'LT', threshold: 1 },
  })
  @IsObject()
  condition!: object;

  @ApiProperty({ enum: ['NORMAL', 'WARNING', 'CRITICAL'], description: '严重级别' })
  @IsIn(['NORMAL', 'WARNING', 'CRITICAL'])
  severity!: Severity;

  @ApiPropertyOptional({ default: true, description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateAnomalyRuleDto {
  @ApiPropertyOptional({ description: '规则名称' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: '规则条件' })
  @IsOptional()
  @IsObject()
  condition?: object;

  @ApiPropertyOptional({ enum: ['NORMAL', 'WARNING', 'CRITICAL'], description: '严重级别' })
  @IsOptional()
  @IsIn(['NORMAL', 'WARNING', 'CRITICAL'])
  severity?: Severity;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class DetectDto {
  @ApiProperty({ description: '电站 id' })
  @IsUUID()
  plantId!: string;

  @ApiProperty({ example: 12.345, description: '当前观测值（kWh）' })
  @IsNumber()
  value!: number;

  @ApiPropertyOptional({
    description: '观测时间戳（ISO 8601），缺省为当前时间',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({ default: 24, description: '历史窗口（小时）' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  windowHours?: number;
}
