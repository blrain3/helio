import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsInt, Min, IsIn, IsOptional, IsObject } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: '订单 id' })
  @IsUUID()
  orderId!: string;

  @ApiPropertyOptional({
    enum: ['mock', 'wechat', 'alipay'],
    default: 'mock',
    description: '支付渠道',
  })
  @IsOptional()
  @IsIn(['mock', 'wechat', 'alipay'])
  provider?: 'mock' | 'wechat' | 'alipay';

  @ApiPropertyOptional({ description: '回调地址' })
  @IsOptional()
  @IsString()
  notifyUrl?: string;
}

export class RefundDto {
  @ApiProperty({ example: 100, description: '退款金额（分）' })
  @IsInt()
  @Min(1, { message: '退款金额必须为正整数' })
  amount!: number;
}

export class PaymentCallbackDto {
  @ApiProperty({ enum: ['mock', 'wechat', 'alipay'] })
  @IsIn(['mock', 'wechat', 'alipay'])
  provider!: 'mock' | 'wechat' | 'alipay';

  @ApiProperty({ description: '渠道交易号' })
  @IsString()
  providerTransactionId!: string;

  @ApiProperty({ description: '商户订单号' })
  @IsString()
  merchantOrderId!: string;

  @ApiProperty({ description: '回调金额（分）' })
  @IsInt()
  amount!: number;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED'] })
  @IsIn(['SUCCESS', 'FAILED'])
  status!: 'SUCCESS' | 'FAILED';

  @ApiProperty({ description: '渠道签名' })
  @IsString()
  signature!: string;

  @ApiProperty({ description: '原始报文' })
  @IsObject()
  rawPayload!: Record<string, unknown>;
}
