import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  PaymentGateway,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallback,
} from '../domain/payment.entity';

/**
 * Mock 支付网关（一等公民，非临时测试代码）。
 *
 * 开发阶段不依赖真实第三方商户账号，即可完成：
 * 创建支付 → 模拟支付 → 回调 → 验签 → 幂等 → 状态流转 → 对账 的完整链路。
 *
 * 验签算法（可替换为真实渠道的 RSA/SHA256 方案）：
 *   signature = sha256(merchantOrderId + providerTransactionId + amount + secret)
 */
@Injectable()
export class MockGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'mock';

  /** Mock 商户密钥（生产可替换为配置）。 */
  private readonly secret = 'helio-mock-secret';

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    // 模拟渠道交易号：MOCK + 时间戳 + 随机段。
    const providerTransactionId = `MOCK${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return {
      providerTransactionId,
      payUrl: `https://pay.mock.helio.io/pay/${providerTransactionId}`,
    };
  }

  async queryPayment(_providerTransactionId: string): Promise<PaymentStatus> {
    // Mock 场景：默认返回 SUCCESS（可扩展为按交易号哈希模拟不同状态）。
    return 'SUCCESS';
  }

  async closePayment(_providerTransactionId: string): Promise<void> {
    // Mock：关闭支付无副作用。
  }

  async refundPayment(
    providerTransactionId: string,
    _amount: number,
    refundNo: string,
  ): Promise<string> {
    // 模拟渠道退款流水号。
    return `REFUND-${providerTransactionId}-${refundNo}`;
  }

  verifyCallback(callback: PaymentCallback): boolean {
    const expected = this.sign(
      callback.merchantOrderId,
      callback.providerTransactionId,
      callback.amount,
    );
    return expected === callback.signature;
  }

  /**
   * 生成回调签名（供测试/客户端模拟回调时使用）。
   * 生产环境签名由第三方渠道生成，此处暴露仅为本地联调便利。
   */
  sign(merchantOrderId: string, providerTransactionId: string, amount: number): string {
    const raw = `${merchantOrderId}${providerTransactionId}${amount}${this.secret}`;
    return createHash('sha256').update(raw).digest('hex');
  }
}
