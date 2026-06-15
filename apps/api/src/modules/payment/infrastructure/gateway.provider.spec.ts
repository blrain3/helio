import { describe, it, expect, vi } from 'vitest';
import { PaymentGatewayProvider } from './gateway.provider';
import { MockGateway } from './mock.gateway';
import { WeChatGateway } from './wechat.gateway';
import { AlipayGateway } from './alipay.gateway';

/** 构造一个最小 ConfigService 替身。 */
function makeConfig(values: Record<string, string> = {}) {
  return {
    get: vi.fn((key: string, def?: unknown) => values[key] ?? def),
  };
}

describe('PaymentGatewayProvider', () => {
  const mock = new MockGateway({} as never);
  const wechat = new WeChatGateway(makeConfig() as never);
  const alipay = new AlipayGateway(makeConfig() as never);

  it('默认路由到 mock', () => {
    const provider = new PaymentGatewayProvider(
      makeConfig() as never,
      mock,
      wechat,
      alipay,
    );
    expect(provider.provider).toBe('mock');
  });

  it('按 PAYMENT_PROVIDER 路由到 wechat', () => {
    const provider = new PaymentGatewayProvider(
      makeConfig({ PAYMENT_PROVIDER: 'wechat' }) as never,
      mock,
      wechat,
      alipay,
    );
    expect(provider.provider).toBe('wechat');
  });

  it('按 PAYMENT_PROVIDER 路由到 alipay', () => {
    const provider = new PaymentGatewayProvider(
      makeConfig({ PAYMENT_PROVIDER: 'alipay' }) as never,
      mock,
      wechat,
      alipay,
    );
    expect(provider.provider).toBe('alipay');
  });

  it('未知 provider 回退 mock', () => {
    const provider = new PaymentGatewayProvider(
      makeConfig({ PAYMENT_PROVIDER: 'unknown' }) as never,
      mock,
      wechat,
      alipay,
    );
    expect(provider.provider).toBe('mock');
  });

  it('影子模式：主链路 mock，createPayment 返回 mock 结果', async () => {
    const provider = new PaymentGatewayProvider(
      makeConfig({ PAYMENT_SHADOW: 'true', PAYMENT_SHADOW_PROVIDER: 'wechat' }) as never,
      mock,
      wechat,
      alipay,
    );
    const result = await provider.createPayment({
      merchantOrderId: 'ORD1',
      amount: 101234,
      notifyUrl: 'https://x/cb',
    });
    // 主链路为 mock，交易号以 MOCK 开头。
    expect(result.providerTransactionId).toMatch(/^MOCK/);
  });

  it('验签路由到 callback.provider 对应网关', () => {
    const provider = new PaymentGatewayProvider(
      makeConfig({ PAYMENT_PROVIDER: 'wechat' }) as never,
      mock,
      wechat,
      alipay,
    );
    // 使用 wechat 网关的 sign 生成签名，verifyCallback 应通过。
    const sig = wechat.sign('ORD1', 'WX1', 101234);
    expect(
      provider.verifyCallback({
        provider: 'wechat',
        providerTransactionId: 'WX1',
        merchantOrderId: 'ORD1',
        amount: 101234,
        status: 'SUCCESS',
        signature: sig,
        rawPayload: {},
      }),
    ).toBe(true);
  });
});
