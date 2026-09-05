import { createHash, createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';

describe('internal reconciliation request signing', () => {
  it('binds the method, API path, timestamp, nonce, and JSON body hash', async () => {
    const module = await import('./reconciliation.handler');
    const signer = (module as Record<string, unknown>)['createInternalRequestHeaders'];

    expect(typeof signer).toBe('function');
    if (typeof signer !== 'function') {
      return;
    }

    const headers = signer({
      method: 'POST',
      path: '/api/payments/reconcile/daily/internal',
      body: '{"date":"2026-09-04"}',
      secret: 'worker-test-secret',
      timestamp: '1757030400000',
      nonce: 'nonce-test',
    }) as Record<string, string>;
    const bodyHash = createHash('sha256').update('{"date":"2026-09-04"}').digest('hex');
    const expected = createHmac('sha256', 'worker-test-secret')
      .update(['POST', '/api/payments/reconcile/daily/internal', '1757030400000', 'nonce-test', bodyHash].join('\n'))
      .digest('hex');

    expect(headers).toMatchObject({
      'x-helio-timestamp': '1757030400000',
      'x-helio-nonce': 'nonce-test',
      'x-helio-signature': expected,
    });
  });
});
