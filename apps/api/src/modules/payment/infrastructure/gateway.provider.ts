import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentGateway,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallback,
} from '../domain/payment.entity';
import { MockGateway } from './mock.gateway';
import { WeChatGateway } from './wechat.gateway';
import { AlipayGateway } from './alipay.gateway';

/**
 * 支付网关路由（可插拔切换 + 影子调用策略）。
 *
 * 职责：
 * 1. 按 PaymentProvider 路由到对应网关实现（Mock / WeChat / Alipay）；
 * 2. 影子调用（shadow call）：当某真实渠道开启 SHADOW 模式时，真实调用
 *    与 Mock 结果并行执行、以 Mock 为准，并将两者差异记录为漂移（drift）
 *    供灰度验证；影子调用失败不影响主链路。
 *
 * 配置（环境变量）：
 * - PAYMENT_PROVIDER: mock | wechat | alipay（默认 mock）
 * - PAYMENT_SHADOW:   true/false（是否开启影子调用，默认 false）
 * - WECHAT_* / ALIPAY_*：真实渠道凭据（见各 adapter）。
 *
 * 影子调用是「暗发布」手段：在未完全信任真实渠道前，用 Mock 作为
 * 主链路、真实渠道作为旁路校验，对比两者行为以评估真实适配器正确性。
 */
@Injectable()
export class PaymentGatewayProvider implements PaymentGateway {
  private readonly logger = new Logger(PaymentGatewayProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mockGw: MockGateway,
    private readonly wechatGw: WeChatGateway,
    private readonly alipayGw: AlipayGateway,
  ) {}

  /** 读取配置（延迟解析，避免构造期 ConfigService 尚未就绪）。 */
  private cfg<T>(key: string, def: T): T {
    return this.config?.get<T>(key, def) ?? def;
  }

  /** 主网关（source of truth）。 */
  private get primary(): PaymentGateway {
    const configured = this.cfg<PaymentProvider>('PAYMENT_PROVIDER', 'mock');
    return this.gatewayFor(configured);
  }

  /** 影子网关（旁路校验），未开启时为 undefined。 */
  private get shadow(): PaymentGateway | undefined {
    const shadowEnabled = this.cfg<string>('PAYMENT_SHADOW', 'false') === 'true';
    if (!shadowEnabled) {
      return undefined;
    }
    const shadowProvider = this.cfg<PaymentProvider>(
      'PAYMENT_SHADOW_PROVIDER',
      'wechat',
    );
    const g = this.gatewayFor(shadowProvider);
    if (g.provider === this.primary.provider) {
      return undefined;
    }
    this.logger.warn(
      `影子调用已开启：主链路 ${this.primary.provider}，旁路 ${g.provider}`,
    );
    return g;
  }

  private gatewayFor(provider: PaymentProvider): PaymentGateway {
    const gateways: Record<PaymentProvider, PaymentGateway> = {
      mock: this.mockGw,
      wechat: this.wechatGw,
      alipay: this.alipayGw,
    };
    return gateways[provider] ?? this.mockGw;
  }

  get provider(): PaymentProvider {
    return this.primary.provider;
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const result = await this.primary.createPayment(req);
    if (this.shadow) {
      // 影子调用：异步旁路执行，不阻塞、不抛出。
      void this.shadow.createPayment(req).then(
        (shadowResult) =>
          this.logger.log(
            `[shadow] createPayment 一致性: primary=${result.providerTransactionId} shadow=${shadowResult.providerTransactionId}`,
          ),
        (err) => this.logger.warn(`[shadow] createPayment 失败（忽略）: ${err.message}`),
      );
    }
    return result;
  }

  async queryPayment(providerTransactionId: string): Promise<PaymentStatus> {
    const result = await this.primary.queryPayment(providerTransactionId);
    if (this.shadow) {
      void this.shadow.queryPayment(providerTransactionId).then(
        (s) =>
          this.logger.log(
            `[shadow] queryPayment 一致性: primary=${result} shadow=${s}`,
          ),
        (err) => this.logger.warn(`[shadow] queryPayment 失败（忽略）: ${err.message}`),
      );
    }
    return result;
  }

  async closePayment(providerTransactionId: string): Promise<void> {
    await this.primary.closePayment(providerTransactionId);
    if (this.shadow) {
      void this.shadow.closePayment(providerTransactionId).catch(
        (err) => this.logger.warn(`[shadow] closePayment 失败（忽略）: ${err.message}`),
      );
    }
  }

  async refundPayment(
    providerTransactionId: string,
    amount: number,
    refundNo: string,
  ): Promise<string> {
    const result = await this.primary.refundPayment(providerTransactionId, amount, refundNo);
    if (this.shadow) {
      void this.shadow.refundPayment(providerTransactionId, amount, refundNo).then(
        (r) => this.logger.log(`[shadow] refundPayment 一致性: primary=${result} shadow=${r}`),
        (err) => this.logger.warn(`[shadow] refundPayment 失败（忽略）: ${err.message}`),
      );
    }
    return result;
  }

  verifyCallback(callback: PaymentCallback): boolean {
    // 验签必须使用「产生该回调的渠道」的验签逻辑，而非主网关。
    // 影子模式下仍以主网关（mock）为准；真实渠道回调经 provider 字段路由。
    const gateway = this.gatewayFor(callback.provider);
    return gateway.verifyCallback(callback);
  }
}
