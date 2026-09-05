import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from '../application/order.service';
import { CreateOrderDto } from '../application/dto/order.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthUser } from '../../auth/domain/user.entity';
import { OrderEntity } from '../domain/order.entity';

/** 订单控制器：订单创建与状态机流转。 */
@ApiTags('order')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Get()
  @ApiOperation({ summary: '查询当前用户订单列表' })
  @ApiResponse({ status: 200, description: '订单列表' })
  async list(@CurrentUser() user: AuthUser): Promise<OrderEntity[]> {
    return this.orders.listByUser(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: '按 id 查询订单' })
  @ApiResponse({ status: 200, description: '订单信息' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderEntity> {
    return this.orders.findById(id, user);
  }

  @Post()
  @ApiOperation({ summary: '创建订单（基于账单，金额校验）' })
  @ApiResponse({ status: 201, description: '订单已创建' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
  ): Promise<OrderEntity> {
    return this.orders.create(dto.billId, dto.amount, user);
  }

  @Patch(':id/submit-payment')
  @ApiOperation({ summary: '提交支付（CREATED → PENDING_PAYMENT）' })
  @ApiResponse({ status: 200, description: '已进入待支付' })
  async submitPayment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderEntity> {
    return this.orders.submitPayment(id, user);
  }

  @Patch(':id/confirm-paid')
  @HttpCode(HttpStatus.OK)
  @Roles('OPERATOR', 'ADMIN')
  @ApiOperation({ summary: '确认支付成功（PENDING_PAYMENT → PAID，联动账单）' })
  @ApiResponse({ status: 200, description: '支付成功' })
  async confirmPaid(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderEntity> {
    return this.orders.confirmPaid(id, user);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: '完成订单（PAID → COMPLETED）' })
  @ApiResponse({ status: 200, description: '订单已完成' })
  async complete(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderEntity> {
    return this.orders.complete(id, user);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: '关闭订单（超时/取消 → CLOSED）' })
  @ApiResponse({ status: 200, description: '订单已关闭' })
  async close(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OrderEntity> {
    return this.orders.close(id, user);
  }
}
