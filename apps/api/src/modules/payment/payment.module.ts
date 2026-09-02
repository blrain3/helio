import { Module } from '@nestjs/common';
import { PaymentController } from './presentation/payment.controller';
import { PaymentService } from './application/payment.service';
import { ReconciliationService } from './application/reconciliation.service';
import { PaymentRepository } from './infrastructure/payment.repository';
import { MockGateway } from './infrastructure/mock.gateway';
import { OrderModule } from '../order/order.module';

/**
 * 支付模块（M4）：支付网关抽象、七步回调链路、退款、日对账。
 *
 * Mock 作为一等公民实现 PaymentGateway 接口，通过 DI 注入；
 * 依赖 OrderModule 的 OrderRepository（支付成功联动订单状态）。
 */
@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    ReconciliationService,
    PaymentRepository,
    MockGateway,
  ],
  exports: [PaymentService, PaymentRepository, ReconciliationService],
})
export class PaymentModule {}
