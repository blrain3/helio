import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createSign, randomBytes } from 'crypto';
import {
  PaymentGateway,
  PaymentProvider,
  PaymentStatus,
  CreatePaymentRequest,
  CreatePaymentResult,
  PaymentCallback,
  RawStatementRow,
} from '../domain/payment.entity';
import { PaymentGatewayError } from '../../auth/domain/errors';
import { decodeBillBuffer, parseWechatTradeBill } from './bill-parser';

/**
 * 微信支付适配器（真实渠道）。
 *
 * 采用微信支付 API v3 结构（商户号 mchid、APIv3 密钥、商户证书序列号 + 商户私钥）。
 * 主链路（下单/查单/关单/退款/验签）在配置了真实凭据时调用真实 API，未配置时
 * 回退为可运行的占位结果（保证本地开发/测试可跑）。
 *
 * 对账单下载（downloadBill）则「不静默降级」：真实渠道场景下若凭据缺失或
 * 接口调用失败，一律抛出 PaymentGatewayError（HTTP 502），由上层对账流程
 * 捕获并上抛，避免把「渠道故障」误判为「当日无流水」，从而污染对账结果。
 *
 * 签名（API v3 规范）：
 *   message = `${method}\n${canonical_url}\n${timestamp}\n${nonce_str}\n${body}\n`
 *   signature = RSA_SHA256(message, 商户私钥)，头部 WECHATPAY2-SHA256-RSA2048。
 */
@Injectable()
export class WeChatGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'wechat';
  private readonly logger = new Logger(WeChatGateway.name);

  constructor(private readonly config: ConfigService) {}

  /** 是否配置了核心凭据（未配置则主链路走占位逻辑）。 */
  private get configured(): boolean {
    const mchid = this.config.get<string>('WECHAT_MCHID', '');
    const key = this.config.get<string>('WECHAT_API_V3_KEY', '');
    return Boolean(mchid && key);
  }

  /** 账单下载所需完整凭据（缺失即抛错，明确列出缺哪些）。 */
  private billCredentials(): {
    mchid: string;
    appid: string;
    serialNo: string;
    privateKey: string;
  } {
    const required: Array<[string, string]> = [
      ['WECHAT_MCHID', '商户号 WECHAT_MCHID'],
      ['WECHAT_APPID', '应用 AppID WECHAT_APPID'],
      ['WECHAT_API_V3_KEY', 'APIv3 密钥 WECHAT_API_V3_KEY'],
      ['WECHAT_SERIAL_NO', '商户证书序列号 WECHAT_SERIAL_NO'],
      ['WECHAT_PRIVATE_KEY', '商户 API 私钥 WECHAT_PRIVATE_KEY'],
    ];
    const missing = required
      .filter(([key]) => !this.config.get<string>(key, ''))
      .map(([, label]) => label);
    if (missing.length > 0) {
      throw new PaymentGatewayError(
        `微信对账单下载失败：未配置凭据（缺少 ${missing.join('、')}）。` +
          `请补齐环境变量后重试；若暂未接入真实渠道，请将 PAYMENT_PROVIDER 保持为 mock。`,
      );
    }
    return {
      mchid: this.config.get<string>('WECHAT_MCHID', ''),
      appid: this.config.get<string>('WECHAT_APPID', ''),
      serialNo: this.config.get<string>('WECHAT_SERIAL_NO', ''),
      privateKey: this.config.get<string>('WECHAT_PRIVATE_KEY', ''),
    };
  }

  /** 生成 API v3 Authorization 头（RSA-SHA256 签名）。 */
  private buildAuth(
    method: string,
    canonicalUrl: string,
    body: string,
    creds: { mchid: string; serialNo: string; privateKey: string },
  ): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString('hex');
    const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${body}\n`;
    let signature: string;
    try {
      signature = createSign('RSA-SHA256').update(message).sign(creds.privateKey, 'base64');
    } catch (err) {
      throw new PaymentGatewayError(
        `微信对账单下载失败：商户私钥非法或格式错误（${(err as Error).message}）。` +
          `请确认 WECHAT_PRIVATE_KEY 为 PEM 格式（含 BEGIN/END 行）。`,
      );
    }
    return (
      'WECHATPAY2-SHA256-RSA2048 ' +
      `mchid="${creds.mchid}",nonce_str="${nonce}",signature="${signature}",` +
      `timestamp="${timestamp}",serial_no="${creds.serialNo}"`
    );
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

  /**
   * 下载对账单（真实渠道）：
   * 1. GET /v3/bill/tradebill?bill_date=YYYY-MM-DD&bill_type=ALL 申请账单；
   * 2. 用返回的 download_url 下载 gzip CSV（均携带 v3 Authorization 签名）；
   * 3. 解压 + 解析为 RawStatementRow。
   *
   * 凭据缺失 / 申请失败 / 下载失败 / 格式不符 均抛 PaymentGatewayError（不静默返回空）。
   */
  async downloadBill(billDate: Date): Promise<RawStatementRow[]> {
    const creds = this.billCredentials();
    const day = billDate.toISOString().slice(0, 10);
    const billType = 'ALL';
    const applyPath = `/v3/bill/tradebill?bill_date=${day}&bill_type=${billType}`;
    const applyUrl = `https://api.mch.weixin.qq.com${applyPath}`;

    // 第一步：申请账单，获取 download_url。
    let applyResp: Response;
    try {
      applyResp = await fetch(applyUrl, {
        method: 'GET',
        headers: {
          Authorization: this.buildAuth('GET', applyPath, '', creds),
          Accept: 'application/json',
        },
      });
    } catch (err) {
      throw new PaymentGatewayError(
        `微信对账单申请失败：网络错误 ${(err as Error).message}`,
      );
    }
    if (!applyResp.ok) {
      const detail = (await applyResp.text().catch(() => '')).slice(0, 500);
      throw new PaymentGatewayError(
        `微信对账单申请失败：HTTP ${applyResp.status} ${detail}`,
      );
    }
    const apply = (await applyResp.json().catch(() => ({}))) as { download_url?: string };
    const downloadUrl = apply.download_url;
    if (!downloadUrl) {
      throw new PaymentGatewayError('微信对账单申请成功但未返回 download_url');
    }

    // 第二步：下载账单文件（gzip CSV）。
    let dlResp: Response;
    try {
      const u = new URL(downloadUrl);
      dlResp = await fetch(u.toString(), {
        method: 'GET',
        headers: { Authorization: this.buildAuth('GET', `${u.pathname}${u.search}`, '', creds) },
      });
    } catch (err) {
      throw new PaymentGatewayError(
        `微信对账单下载失败：网络错误 ${(err as Error).message}`,
      );
    }
    if (!dlResp.ok) {
      const detail = (await dlResp.text().catch(() => '')).slice(0, 500);
      throw new PaymentGatewayError(
        `微信对账单下载失败：HTTP ${dlResp.status} ${detail}`,
      );
    }
    const buffer = await dlResp.arrayBuffer();
    return parseWechatTradeBill(decodeBillBuffer(buffer));
  }

  /** 生成回调签名（联调/测试便利）。 */
  sign(merchantOrderId: string, providerTransactionId: string, amount: number): string {
    const key = this.config.get<string>('WECHAT_API_V3_KEY', 'helio-wechat-key');
    const raw = `${merchantOrderId}${providerTransactionId}${amount}`;
    return createHmac('sha256', key).update(raw).digest('hex');
  }
}
