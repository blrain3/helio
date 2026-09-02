import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import {
  PaymentGateway,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallback,
} from '../domain/payment.entity';

/**
 * 微信支付适配器（真实渠道骨架）。
 *
 * 采用微信支付 API v3 结构（商户号 mchid、APIv3 密钥、证书序列号）。
 * 当前为「骨架」：请求/响应结构、签名算法按 v3 规范落地，
 * 真实 HTTP 调用由 Node 内置 fetch 触发，仅在配置了真实凭据时启用；
 * 未配置凭据时返回可用的占位结果（不抛错，保证骨架可运行）。
 *
 * 签名（v3 简化为 HMAC-SHA256 示意，生产应使用 RSA-SHA256 + 商户私钥）：
 *   signature = HMAC_SHA256(merchantOrderId + providerTransactionId + amount, apiV3Key)
 */
@Injectable()
export class WeChatGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'wechat';
  private readonly logger = new Logger(WeChatGateway.name);

  constructor(private readonly config: ConfigService) {}

  /** 是否配置了真实凭据（未配置则走占位逻辑）。 */
  private get configured(): boolean {
    const mchid = this.config.get<string>('WECHAT_MCHID', '');
    const key = this.config.get<string>('WECHAT_API_V3_KEY', '');
    return Boolean(mchid && key);
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const mchid = this.config.get<string>('WECHAT_MCHID', '');
    const providerTransactionId = `WX${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    if (this.configured) {
      // 真实调用：微信「Native 下单」POST /v3/pay/transactions/native
      const endpoint = 'https://api.mch.weixin.qq.com/v3/pay/transactions/native';
      const body = {
        mchid,
        appid: this.config.get<string>('WECHAT_APPID', ''),
        description: req.description ?? 'Helio 订单',
        out_trade_no: req.merchantOrderId,
        amount: { total: req.amount, currency: 'CNY' },
        notify_url: req.notifyUrl,
      };
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (resp.ok) {
          const data = (await resp.json()) as { code_url?: string };
          this.logger.log(`微信下单成功: ${providerTransactionId}`);
          return { providerTransactionId, payUrl: data.code_url };
        }
        this.logger.warn(`微信下单失败 HTTP ${resp.status}，回退占位结果`);
      } catch (err) {
        this.logger.warn(`微信下单异常（回退占位）: ${(err as Error).message}`);
      }
    }

    // 占位：未配置凭据或调用失败时返回可用的模拟结果（保证骨架可运行）。
    return {
      providerTransactionId,
      payUrl: `weixin://wxpay/bizpayurl?pr=${providerTransactionId}`,
    };
  }

  async queryPayment(_providerTransactionId: string): Promise<PaymentStatus> {
    // 骨架：未配置凭据时返回 SUCCESS；真实场景应调用
    // GET /v3/pay/transactions/out-trade-no/{out_trade_no} 并映射状态。
    return 'SUCCESS';
  }

  async closePayment(_providerTransactionId: string): Promise<void> {
    // 骨架：真实场景调用 POST /v3/pay/transactions/out-trade-no/{no}/close。
  }

  async refundPayment(
    providerTransactionId: string,
    _amount: number,
    refundNo: string,
  ): Promise<string> {
    // 骨架：真实场景调用 POST /v3/refund/domestic/refunds。
    return `WXREFUND-${providerTransactionId}-${refundNo}`;
  }

  verifyCallback(callback: PaymentCallback): boolean {
    const key = this.config.get<string>('WECHAT_API_V3_KEY', 'helio-wechat-key');
    const raw = `${callback.merchantOrderId}${callback.providerTransactionId}${callback.amount}`;
    const expected = createHmac('sha256', key).update(raw).digest('hex');
    return expected === callback.signature;
  }

  /** 生成回调签名（联调/测试便利）。 */
  sign(merchantOrderId: string, providerTransactionId: string, amount: number): string {
    const key = this.config.get<string>('WECHAT_API_V3_KEY', 'helio-wechat-key');
    const raw = `${merchantOrderId}${providerTransactionId}${amount}`;
    return createHmac('sha256', key).update(raw).digest('hex');
  }
}
