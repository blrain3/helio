/**
 * 支付域领域实体、状态机与网关抽象。
 *
 * 关键设计（符合架构约定）：
 * 1. 订单 / 支付 / 退款拥有「独立状态机」，不合并字段；
 * 2. PaymentGateway 抽象，Mock 作为一等公民实现，可插拔 WeChat/Alipay；
 * 3. 金额以「分」为整数单位。
 */

/** 支付渠道。 */
export type PaymentProvider = 'mock' | 'wechat' | 'alipay';

/** 支付状态机：CREATED → PENDING → SUCCESS（异常 FAILED / CLOSED / REFUNDED）。 */
export type PaymentStatus = 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CLOSED' | 'REFUNDED';

/** 退款状态机：CREATED → PROCESSING → REFUNDED（异常 FAILED）。 */
export type RefundStatus = 'CREATED' | 'PROCESSING' | 'REFUNDED' | 'FAILED';

/** 支付流水。 */
export interface PaymentEntity {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  providerTransactionId: string | null;
  merchantOrderId: string;
  amount: number;
  refundedAmount: number;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** 退款单。 */
export interface RefundEntity {
  id: string;
  paymentId: string;
  refundNo: string;
  providerRefundId: string | null;
  amount: number;
  status: RefundStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** 创建支付请求（支付网关入参）。 */
export interface CreatePaymentRequest {
  merchantOrderId: string;
  amount: number;
  /** 支付结果回调地址。 */
  notifyUrl: string;
  description?: string;
}

/** 创建支付响应（支付网关返回）。 */
export interface CreatePaymentResult {
  /** 渠道交易号（支付网关侧流水号）。 */
  providerTransactionId: string;
  /** 收银台/支付参数（Mock 场景返回模拟支付链接）。 */
  payUrl?: string;
}

/** 支付回调报文（统一结构，适配各渠道差异）。 */
export interface PaymentCallback {
  provider: PaymentProvider;
  /** 渠道交易号。 */
  providerTransactionId: string;
  /** 商户订单号（业务侧）。 */
  merchantOrderId: string;
  /** 回调金额（分），用于金额校验。 */
  amount: number;
  /** 渠道状态：SUCCESS / FAILED。 */
  status: 'SUCCESS' | 'FAILED';
  /** 渠道签名，用于验签。 */
  signature: string;
  /** 原始报文（落库审计）。 */
  rawPayload: Record<string, unknown>;
}

/**
 * 支付网关抽象接口。
 * Mock / WeChat / Alipay 均实现此接口，通过 DI 或配置切换（可插拔第三方服务）。
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider;

  /** 创建支付（下单）。 */
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>;

  /** 查询支付状态。 */
  queryPayment(providerTransactionId: string): Promise<PaymentStatus>;

  /** 关闭支付。 */
  closePayment(providerTransactionId: string): Promise<void>;

  /** 发起退款。 */
  refundPayment(providerTransactionId: string, amount: number, refundNo: string): Promise<string>;

  /** 校验回调签名。 */
  verifyCallback(callback: PaymentCallback): boolean;
}

/** 支付状态机：定义合法流转。 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  CREATED: ['PENDING', 'CLOSED', 'FAILED'],
  PENDING: ['SUCCESS', 'FAILED', 'CLOSED'],
  SUCCESS: ['REFUNDED'],
  FAILED: [],
  CLOSED: [],
  REFUNDED: [],
};

/** 退款状态机：定义合法流转。 */
export const REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  CREATED: ['PROCESSING', 'FAILED'],
  PROCESSING: ['REFUNDED', 'FAILED'],
  REFUNDED: [],
  FAILED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionRefund(from: RefundStatus, to: RefundStatus): boolean {
  return REFUND_TRANSITIONS[from]?.includes(to) ?? false;
}
