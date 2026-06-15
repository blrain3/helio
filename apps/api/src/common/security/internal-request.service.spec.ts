import { createHash, createHmac } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const secret = 'task-5-test-secret';
const timestamp = Date.parse('2026-09-05T00:00:00.000Z');
const body = { date: '2026-09-04' };
const path = '/api/payments/reconcile/daily/internal';
const originalNodeEnv = process.env.NODE_ENV;

function signedRequest(overrides: Record<string, string> = {}) {
  const nonce = overrides['x-helio-nonce'] ?? 'nonce-1';
  const signedAt = overrides['x-helio-timestamp'] ?? String(timestamp);
  const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const signature = createHmac('sha256', secret)
    .update(['POST', path, signedAt, nonce, bodyHash].join('\n'))
    .digest('hex');

  return {
    headers: {
      'x-helio-timestamp': signedAt,
      'x-helio-nonce': nonce,
      'x-helio-signature': signature,
      ...overrides,
    },
    method: 'POST',
    path,
    body,
  };
}

async function makeService(
  set: ReturnType<typeof vi.fn>,
  disconnect?: ReturnType<typeof vi.fn>,
) {
  const loaded = await import('./internal-request.service')
    .then((module) => ({ module }))
    .catch((error: unknown) => ({ error }));

  expect(loaded).toHaveProperty('module');
  if (!('module' in loaded)) {
    throw loaded.error;
  }
  return new loaded.module.InternalRequestService({ set, disconnect } as never);
}

afterEach(() => {
  vi.useRealTimers();
  delete process.env.INTERNAL_REQUEST_SECRET;
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('InternalRequestService', () => {
  it('rejects an expired signed request before consuming its nonce', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp + 5 * 60 * 1000 + 1));
    process.env.INTERNAL_REQUEST_SECRET = secret;
    const set = vi.fn();
    const service = await makeService(set);

    await expect(service.assertInternalRequest(signedRequest())).rejects.toThrow('过期');
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects a replayed nonce after a valid request consumes it', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    process.env.INTERNAL_REQUEST_SECRET = secret;
    const set = vi.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const service = await makeService(set);
    const request = signedRequest();

    await expect(service.assertInternalRequest(request)).resolves.toBeUndefined();
    await expect(service.assertInternalRequest(request)).rejects.toThrow('重放');
    expect(set).toHaveBeenLastCalledWith('helio:internal-request:nonce:nonce-1', '1', 'EX', 300, 'NX');
  });

  it('rejects a valid signature when the received body differs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    process.env.INTERNAL_REQUEST_SECRET = secret;
    const set = vi.fn();
    const service = await makeService(set);

    await expect(
      service.assertInternalRequest({ ...signedRequest(), body: { date: '2026-09-05' } }),
    ).rejects.toThrow('签名无效');
    expect(set).not.toHaveBeenCalled();
  });

  it('rejects production requests when the internal secret is unset', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    process.env.NODE_ENV = 'production';
    const set = vi.fn();
    const service = await makeService(set);

    await expect(service.assertInternalRequest(signedRequest())).rejects.toThrow('未配置内部请求密钥');
    expect(set).not.toHaveBeenCalled();
  });

  it('disconnects the nonce client when the module closes', async () => {
    const disconnect = vi.fn();
    const service = await makeService(vi.fn(), disconnect);
    const lifecycle = service as unknown as { onModuleDestroy?: () => void };

    expect(typeof lifecycle.onModuleDestroy).toBe('function');
    lifecycle.onModuleDestroy?.();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
