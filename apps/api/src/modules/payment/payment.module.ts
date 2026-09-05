import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { PaymentController } from './presentation/payment.controller';
import { PaymentService } from './application/payment.service';
import { MockPaymentService } from './application/mock-payment.service';
import { ReconciliationService } from './application/reconciliation.service';
import { PaymentRepository } from './infrastructure/payment.repository';
import { ReconciliationRepository } from './infrastructure/reconciliation.repository';
import { MockGateway } from './infrastructure/mock.gateway';
import { WeChatGateway } from './infrastructure/wechat.gateway';
import { AlipayGateway } from './infrastructure/alipay.gateway';
import { PaymentGatewayProvider } from './infrastructure/gateway.provider';
import { OrderModule } from '../order/order.module';
import {
  InternalRequestService,
  INTERNAL_REQUEST_NONCE_STORE,
} from '../../common/security/internal-request.service';

/**
 * 支付模块（M4 + M4b）：支付网关抽象、七步回调链路、退款、日对账。
 *
 * M4b：PaymentGatewayProvider 按 PaymentProvider 路由网关
 * （Mock / WeChat / Alipay），支持影子调用切换策略。
 * 依赖 OrderModule 的 OrderRepository（支付成功联动订单状态）。
 */
@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    MockPaymentService,
    ReconciliationService,
    InternalRequestService,
    {
      provide: INTERNAL_REQUEST_NONCE_STORE,
      useFactory: (): Redis =>
        new Redis(
          process.env.REDIS_URL ??
            `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? '6379'}`,
          { lazyConnect: true },
        ),
    },
    PaymentRepository,
    ReconciliationRepository,
    MockGateway,
    WeChatGateway,
    AlipayGateway,
    PaymentGatewayProvider,
  ],
  exports: [PaymentService, PaymentRepository, ReconciliationService, ReconciliationRepository, PaymentGatewayProvider],
})
export class PaymentModule {}
