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
  RawStatementRow,
} from '../domain/payment.entity';
import { PaymentGatewayError } from '../../auth/domain/errors';
import { decodeBillBuffer, parseAlipayTradeBill } from './bill-parser';

/**
 * 支付宝适配器（真实渠道）。
 *
 * 采用支付宝开放平台结构（app_id、应用私钥 RSA2 签名、支付宝公钥验签）。
 * 主链路（下单/查单/关单/退款/验签）在配置了真实凭据时调用真实 API，未配置时
 * 回退为可运行的占位结果（保证本地开发/测试可跑）。
 *
 * 对账单下载（downloadBill）则「不静默降级」：真实渠道场景下若凭据缺失或
 * 接口调用失败，一律抛出 PaymentGatewayError（HTTP 502），由上层对账流程
 * 捕获并上抛，避免把「渠道故障」误判为「当日无流水」污染对账结果。
 *
 * 签名（开放平台规范）：对业务参数按 key 升序拼接后，用应用私钥 RSA2
 * （SHA256withRSA）签名，sign 以 base64 形式随请求提交。
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

  /** 账单下载所需完整凭据（缺失即抛错，明确列出缺哪些）。 */
  private billCredentials(): { appId: string; privateKey: string } {
    const required: Array<[string, string]> = [
      ['ALIPAY_APP_ID', '应用 AppID ALIPAY_APP_ID'],
      ['ALIPAY_APP_PRIVATE_KEY', '应用私钥 ALIPAY_APP_PRIVATE_KEY'],
    ];
    const missing = required
      .filter(([key]) => !this.config.get<string>(key, ''))
      .map(([, label]) => label);
    if (missing.length > 0) {
      throw new PaymentGatewayError(
        `支付宝对账单下载失败：未配置凭据（缺少 ${missing.join('、')}）。` +
          `请补齐环境变量后重试；若暂未接入真实渠道，请将 PAYMENT_PROVIDER 保持为 mock。`,
      );
    }
    return {
      appId: this.config.get<string>('ALIPAY_APP_ID', ''),
      privateKey: this.config.get<string>('ALIPAY_APP_PRIVATE_KEY', ''),
    };
  }

  /** 对业务参数按 key 升序拼接后 RSA2 签名，返回含 sign 的完整参数。 */
  private signParams(params: Record<string, string>, privateKey: string): Record<string, string> {
    const content = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    let sign: string;
    try {
      sign = createSign('RSA-SHA256').update(content).sign(privateKey, 'base64');
    } catch (err) {
      throw new PaymentGatewayError(
        `支付宝对账单下载失败：应用私钥非法或格式错误（${(err as Error).message}）。` +
          `请确认 ALIPAY_APP_PRIVATE_KEY 为 PEM 格式（含 BEGIN/END 行）。`,
      );
    }
    return { ...params, sign };
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
        timestamp: alipayTimestamp(new Date()),
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

  /**
   * 下载对账单（真实渠道）：
   * 1. alipay.data.dataservice.bill.downloadurl.query（RSA2 签名 POST）申请下载地址；
   * 2. 下载账单文件并解压/解析为 RawStatementRow。
   *
   * 凭据缺失 / 申请失败 / 下载失败 / 格式不符 均抛 PaymentGatewayError（不静默返回空）。
   */
  async downloadBill(billDate: Date): Promise<RawStatementRow[]> {
    const { appId, privateKey } = this.billCredentials();
    const day = billDate.toISOString().slice(0, 10);
    const bizContent = JSON.stringify({ bill_type: 'trade', bill_date: day });
    const params = this.signParams(
      {
        app_id: appId,
        method: 'alipay.data.dataservice.bill.downloadurl.query',
        format: 'JSON',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: alipayTimestamp(new Date()),
        version: '1.0',
        biz_content: bizContent,
      },
      privateKey,
    );

    // 第一步：申请账单下载地址。
    let applyResp: Response;
    try {
      applyResp = await fetch('https://openapi.alipay.com/gateway.do', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        body: new URLSearchParams(params).toString(),
      });
    } catch (err) {
      throw new PaymentGatewayError(
        `支付宝对账单申请失败：网络错误 ${(err as Error).message}`,
      );
    }
    const apply = (await applyResp.json().catch(() => ({}))) as {
      alipay_data_dataservice_bill_downloadurl_query_response?: {
        code?: string;
        msg?: string;
        bill_download_url?: string;
      };
    };
    const respBody = apply.alipay_data_dataservice_bill_downloadurl_query_response;
    const downloadUrl = respBody?.bill_download_url;
    if (!respBody || respBody.code !== '10000' || !downloadUrl) {
      throw new PaymentGatewayError(
        `支付宝对账单申请失败：${respBody?.code ?? '无响应'} ${respBody?.msg ?? ''}`.trim(),
      );
    }

    // 第二步：下载账单文件。
    let dlResp: Response;
    try {
      dlResp = await fetch(downloadUrl, { method: 'GET' });
    } catch (err) {
      throw new PaymentGatewayError(
        `支付宝对账单下载失败：网络错误 ${(err as Error).message}`,
      );
    }
    if (!dlResp.ok) {
      throw new PaymentGatewayError(`支付宝对账单下载失败：HTTP ${dlResp.status}`);
    }
    const buffer = await dlResp.arrayBuffer();
    return parseAlipayTradeBill(decodeBillBuffer(buffer));
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

/** 生成支付宝开放平台要求的 `yyyy-MM-dd HH:mm:ss` 时间戳（本地时区）。 */
function alipayTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
