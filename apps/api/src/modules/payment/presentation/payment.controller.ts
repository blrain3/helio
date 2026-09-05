import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { PaymentService } from '../application/payment.service';
import { ReconciliationService } from '../application/reconciliation.service';
import { MockPaymentService } from '../application/mock-payment.service';
import {
  CreatePaymentDto,
  RefundDto,
  PaymentCallbackDto,
} from '../application/dto/payment.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InternalRequestService } from '../../../common/security/internal-request.service';
import { PaymentEntity, RefundEntity } from '../domain/payment.entity';
import { AuthUser } from '../../auth/domain/user.entity';
import { ForbiddenError } from '../../auth/domain/errors';

/**
 * 支付控制器：支付创建、回调、退款、对账。
 * 回调端点标记 @Public（第三方渠道回调无法携带业务 JWT，靠验签保证安全）。
 */
@ApiTags('payment')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    private readonly reconciliation: ReconciliationService,
    private readonly mockPayments: MockPaymentService,
    private readonly internalRequests: InternalRequestService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询当前用户支付流水' })
  @ApiResponse({ status: 200, description: '支付流水列表' })
  async list(@CurrentUser() user: AuthUser): Promise<PaymentEntity[]> {
    return this.payments.listByUser(user);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建支付（下单）' })
  @ApiResponse({ status: 201, description: '支付已创建' })
  async create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PaymentEntity> {
    return this.payments.createPayment(
      dto.orderId,
      dto.provider ?? 'mock',
      dto.notifyUrl ?? '',
      user,
    );
  }

  @Post(':id/mock-complete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '开发环境完成 Mock 支付并触发已签名回调' })
  @ApiResponse({ status: 200, description: 'Mock 回调已处理' })
  async completeMockPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ack: string }> {
    return this.mockPayments.complete(id, user);
  }

  @Post('callback')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '支付回调（验签→落库→幂等→金额校验→状态流转→ACK）' })
  @ApiResponse({ status: 200, description: 'ACK' })
  async callback(@Body() dto: PaymentCallbackDto): Promise<{ ack: string }> {
    if (dto.provider === 'mock') {
      throw new ForbiddenError('Mock 支付回调仅可由受控演示流程处理');
    }

    return this.payments.handleCallback({
      provider: dto.provider,
      providerTransactionId: dto.providerTransactionId,
      merchantOrderId: dto.merchantOrderId,
      amount: dto.amount,
      status: dto.status,
      signature: dto.signature,
      rawPayload: dto.rawPayload,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询支付流水' })
  @ApiResponse({ status: 200, description: '支付流水信息' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PaymentEntity> {
    return this.payments.findById(id, user);
  }

  @Patch(':id/close')
  @ApiBearerAuth()
  @ApiOperation({ summary: '关闭支付' })
  @ApiResponse({ status: 200, description: '支付已关闭' })
  async close(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PaymentEntity> {
    return this.payments.closePayment(id, user);
  }

  @Post(':id/refund')
  @ApiBearerAuth()
  @ApiOperation({ summary: '发起退款' })
  @ApiResponse({ status: 201, description: '退款单已创建' })
  async refund(
    @Param('id') id: string,
    @Body() dto: RefundDto,
    @CurrentUser() user: AuthUser,
  ): Promise<RefundEntity> {
    const refundNo = `RFN${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return this.payments.refund(id, dto.amount, refundNo, user);
  }

  @Post('reconcile/daily')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '执行日对账' })
  @ApiResponse({ status: 200, description: '对账结果' })
  async reconcile(@Body() body: { date: string }): Promise<{
    total: number;
    matched: number;
    discrepancies: unknown[];
  }> {
    return this.reconciliation.reconcile(new Date(body.date));
  }

  @Post('reconcile/daily/internal')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '内部触发日对账（worker 定时调用，HMAC 请求签名校验）' })
  @ApiResponse({ status: 200, description: '对账结果' })
  async reconcileInternal(
    @Req() request: FastifyRequest,
    @Body() body: { date: string },
  ): Promise<{
    total: number;
    matched: number;
    discrepancies: unknown[];
  }> {
    await this.internalRequests.assertInternalRequest({
      headers: request.headers,
      method: request.method,
      path: new URL(request.url, 'http://helio.internal').pathname,
      body,
    });
    return this.reconciliation.reconcile(new Date(body.date));
  }

  @Patch('reconcile/diff/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: '解决对账差异（PENDING → RESOLVED，解锁冻结退款）' })
  @ApiResponse({ status: 200, description: '差异已解决' })
  async resolveDiff(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ id: string; status: string }> {
    return this.reconciliation.resolveDiff(id, user);
  }
}
