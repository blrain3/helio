import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: '账单 id' })
  @IsUUID()
  billId!: string;

  @ApiProperty({ example: 1012, description: '订单金额（分）' })
  @IsInt()
  @Min(0, { message: '订单金额不能为负' })
  amount!: number;
}
