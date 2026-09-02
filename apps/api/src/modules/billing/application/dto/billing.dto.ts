import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min, IsDateString } from 'class-validator';

export class GenerateBillDto {
  @ApiProperty({ description: '电站 id' })
  @IsUUID()
  plantId!: string;

  @ApiProperty({ example: 1234.56, description: '计费周期发电量（kWh）' })
  @IsNumber()
  @Min(0, { message: '发电量不能为负' })
  consumedKwh!: number;

  @ApiProperty({ example: '2026-08-01T00:00:00Z', description: '周期起始' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-08-31T23:59:59Z', description: '周期结束' })
  @IsDateString()
  periodEnd!: string;
}
