import { Injectable } from '@nestjs/common';
import { ForbiddenError, ValidationError } from '../../auth/domain/errors';
import { MockGateway } from '../infrastructure/mock.gateway';
import { PaymentService } from './payment.service';

/**
 * Development-only bridge for exercising the Mock provider callback path.
 * Browser callers select only an existing payment; all callback fields,
 * including the signed success state, are derived on the server.
 */
@Injectable()
export class MockPaymentService {
  constructor(
    private readonly payments: PaymentService,
    private readonly gateway: MockGateway,
  ) {}

  async complete(paymentId: string): Promise<{ ack: string }> {
    if (!this.isEnabled()) {
      throw new ForbiddenError('Mock 支付演示仅在开发环境且 Mock 渠道启用时可用');
    }

    const payment = await this.payments.findById(paymentId);
    if (payment.provider !== 'mock') {
      throw new ValidationError('仅 Mock 支付流水可触发演示回调');
    }
    if (!payment.providerTransactionId) {
      throw new ValidationError('Mock 支付流水缺少渠道交易号');
    }

    return this.payments.handleCallback(
      this.gateway.createSuccessCallback(payment),
    );
  }

  private isEnabled(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      (process.env.PAYMENT_PROVIDER ?? 'mock') === 'mock'
    );
  }
}
