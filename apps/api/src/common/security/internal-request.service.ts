import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';
import { UnauthorizedError } from '../../modules/auth/domain/errors';

export const INTERNAL_REQUEST_NONCE_STORE = 'INTERNAL_REQUEST_NONCE_STORE';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL_SECONDS = 5 * 60;

interface InternalRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  body: unknown;
}

@Injectable()
export class InternalRequestService implements OnModuleDestroy {
  constructor(
    @Inject(INTERNAL_REQUEST_NONCE_STORE)
    private readonly nonces: Pick<Redis, 'set' | 'disconnect'>,
  ) {}

  onModuleDestroy(): void {
    this.nonces.disconnect();
  }

  async assertInternalRequest({ headers, method, path, body }: InternalRequest): Promise<void> {
    const timestamp = this.header(headers, 'x-helio-timestamp');
    const nonce = this.header(headers, 'x-helio-nonce');
    const signature = this.header(headers, 'x-helio-signature');
    if (!timestamp || !nonce || !signature || !/^\d+$/.test(timestamp) || !/^[A-Za-z0-9_-]{1,128}$/.test(nonce)) {
      throw new UnauthorizedError('内部请求头无效');
    }

    const signedAt = Number(timestamp);
    if (!Number.isSafeInteger(signedAt) || Math.abs(Date.now() - signedAt) > MAX_CLOCK_SKEW_MS) {
      throw new UnauthorizedError('内部请求已过期');
    }

    const bodyHash = createHash('sha256').update(JSON.stringify(body) ?? '').digest('hex');
    const expected = createHmac('sha256', this.secret())
      .update([method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n'))
      .digest('hex');
    if (!/^[a-f0-9]{64}$/i.test(signature) || !this.sameSignature(signature, expected)) {
      throw new UnauthorizedError('内部请求签名无效');
    }

    const consumed = await this.nonces.set(
      `helio:internal-request:nonce:${nonce}`,
      '1',
      'EX',
      NONCE_TTL_SECONDS,
      'NX',
    );
    if (consumed !== 'OK') {
      throw new UnauthorizedError('内部请求重放');
    }
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name];
    return typeof value === 'string' ? value : undefined;
  }

  private secret(): string {
    const secret = process.env.INTERNAL_REQUEST_SECRET;
    if (secret) {
      return secret;
    }
    if (process.env.NODE_ENV === 'test') {
      return 'helio-test-internal-request-secret';
    }
    throw new UnauthorizedError('未配置内部请求密钥');
  }

  private sameSignature(actual: string, expected: string): boolean {
    const actualBytes = Buffer.from(actual, 'hex');
    const expectedBytes = Buffer.from(expected, 'hex');
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
  }
}
