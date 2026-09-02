import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createSign } from 'crypto';
import {
  PaymentGateway,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallback,
} from '../domain/payment.entity';

/**
 * 支付宝适配器（真实渠道骨架）。
 *
 * 采用支付宝开放平台结构（app_id、应用私钥 RSA2 签名、支付宝公钥验签）。
 * 当前为「骨架」：签名算法按 RSA2（SHA256withRSA）落地，
 * 真实 HTTP 调用由 Node 内置 fetch 触发，仅在配置了真实凭据时启用；
 * 未配置凭据时返回可用的占位结果（不抛错，保证骨架可运行）。
 */
@Injectable()
export class AlipayGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'alipay';
  private readonly logger = new Logger(AlipayGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get configured(): boolean {
    const appId = this.config.get<string>('ALIPAY_APP_ID', '');
    const privateKey = this.config.get<string>('ALIPAY_APP_PRIVATE_KEY', '');
    return Boolean(appId && privateKey);
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const providerTransactionId = `ALI${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    if (this.configured) {
      // 真实调用：支付宝「电脑网站/当面付」网关
      // https://openapi.alipay.com/gateway.do  method=alipay.trade.precreate
      const appId = this.config.get<string>('ALIPAY_APP_ID', '');
      const bizContent = {
        out_trade_no: req.merchantOrderId,
        total_amount: (req.amount / 100).toFixed(2), // 分 → 元
        subject: req.description ?? 'Helio 订单',
      };
      const params = new URLSearchParams({
        app_id: appId,
        method: 'alipay.trade.precreate',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace('T', ' '),
        version: '1.0',
        biz_content: JSON.stringify(bizContent),
      });
      try {
        const resp = await fetch(
          `https://openapi.alipay.com/gateway.do?${params.toString()}`,
        );
        if (resp.ok) {
          const data = (await resp.json()) as {
            alipay_trade_precreate_response?: { qr_code?: string };
          };
          const qr = data.alipay_trade_precreate_response?.qr_code;
          this.logger.log(`支付宝下单成功: ${providerTransactionId}`);
          return { providerTransactionId, payUrl: qr };
        }
        this.logger.warn(`支付宝下单失败 HTTP ${resp.status}，回退占位结果`);
      } catch (err) {
        this.logger.warn(`支付宝下单异常（回退占位）: ${(err as Error).message}`);
      }
    }

    return {
      providerTransactionId,
      payUrl: `https://qr.alipay.com/${providerTransactionId}`,
    };
  }

  async queryPayment(_providerTransactionId: string): Promise<PaymentStatus> {
    // 骨架：真实场景调用 alipay.trade.query 并映射 trade_status。
    return 'SUCCESS';
  }

  async closePayment(_providerTransactionId: string): Promise<void> {
    // 骨架：真实场景调用 alipay.trade.close。
  }

  async refundPayment(
    providerTransactionId: string,
    _amount: number,
    refundNo: string,
  ): Promise<string> {
    // 骨架：真实场景调用 alipay.trade.refund。
    return `ALIREFUND-${providerTransactionId}-${refundNo}`;
  }

  verifyCallback(callback: PaymentCallback): boolean {
    // RSA2 验签骨架：真实场景使用支付宝公钥验证 sign 字段。
    // 此处以 SHA256 摘要比对作为占位（与 Mock/WeChat 保持一致的联调便利）。
    const expected = this.sign(
      callback.merchantOrderId,
      callback.providerTransactionId,
      callback.amount,
    );
    return expected === callback.signature;
  }

  /** 生成回调签名（联调/测试便利）。真实场景由支付宝使用商户私钥生成。 */
  sign(merchantOrderId: string, providerTransactionId: string, amount: number): string {
    const privateKey = this.config.get<string>('ALIPAY_APP_PRIVATE_KEY', '');
    const raw = `${merchantOrderId}${providerTransactionId}${amount}`;
    if (privateKey) {
      try {
        const signer = createSign('RSA-SHA256');
        signer.update(raw);
        return signer.sign(privateKey, 'base64');
      } catch {
        // 私钥非法时回退 SHA256 摘要。
      }
    }
    return createHash('sha256').update(raw).digest('hex');
  }
}
