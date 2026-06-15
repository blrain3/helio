import { describe, expect, it, vi } from 'vitest';
import type { HelioRequestOptions } from '@helio/api-client';
import { createApi, queryKeys } from './api';
import { createAuthenticatedClient } from './api-client';
import { createSessionStore, type StorageLike } from './session';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('createApi', () => {
  it('loads plants through the API transport instead of returning demo records', async () => {
    const requestedPaths: string[] = [];
    const api = createApi({
      request: async <T>(path: string): Promise<T> => {
        requestedPaths.push(path);
        if (path !== '/plants') {
          throw new Error(`unexpected path: ${path}`);
        }

        return [
          {
            id: 'plant-1',
            name: '南站',
            capacity: 600,
            location: null,
            userId: 'user-1',
            createdAt: '2026-09-04T08:00:00.000Z',
            updatedAt: '2026-09-04T08:00:00.000Z',
          },
        ] as T;
      },
    });

    await expect(api.listPlants()).resolves.toEqual([
      {
        id: 'plant-1',
        name: '南站',
        capacityKw: 600,
        location: '未填写',
        status: 'UNKNOWN',
        createdAt: '2026-09-04T08:00:00.000Z',
      },
    ]);
    expect(requestedPaths).toEqual(['/plants']);
  });

  it('loads every console list through its API endpoint instead of demo data', async () => {
    const requestedPaths: string[] = [];
    const api = createApi({
      request: async <T>(path: string): Promise<T> => {
        requestedPaths.push(path);
        const payloads: Record<string, unknown> = {
          '/plants': [
            {
              id: 'plant-1',
              name: '南站',
              capacity: 600,
              location: '上海',
              createdAt: '2026-09-04T08:00:00.000Z',
            },
          ],
          '/devices': [
            {
              id: 'device-1',
              plantId: 'plant-1',
              name: '逆变器',
              serialNo: 'INV-1',
              type: 'INVERTER',
              createdAt: '2026-09-04T08:00:00.000Z',
            },
          ],
          '/bills': [
            {
              id: 'bill-1',
              plantId: 'plant-1',
              consumedKwh: 42.5,
              totalAmount: 1250,
              periodStart: '2026-08-01T00:00:00.000Z',
              status: 'ISSUED',
              createdAt: '2026-09-01T00:00:00.000Z',
            },
          ],
          '/orders': [
            {
              id: 'order-1',
              billId: 'bill-1',
              amount: 1250,
              status: 'PENDING_PAYMENT',
              createdAt: '2026-09-01T01:00:00.000Z',
            },
          ],
          '/payments': [
            {
              id: 'payment-1',
              orderId: 'order-1',
              provider: 'mock',
              providerTransactionId: 'MOCK-1',
              amount: 1250,
              status: 'PENDING',
              createdAt: '2026-09-01T02:00:00.000Z',
            },
          ],
          '/anomalies': [
            {
              id: 'anomaly-1',
              plantId: 'plant-1',
              ruleId: 'low-generation',
              severity: 'WARNING',
              actualValue: 2.5,
              detectedAt: '2026-09-01T02:00:00.000Z',
            },
          ],
        };

        return payloads[path] as T;
      },
    });

    await Promise.all([
      api.listPlants(),
      api.listDevices(),
      api.listBills(),
      api.listOrders(),
      api.listPayments(),
      api.listAnomalies(),
    ]);

    expect(requestedPaths).toEqual([
      '/plants',
      '/devices',
      '/bills',
      '/orders',
      '/payments',
      '/anomalies',
    ]);
  });

  it('invalidates affected query keys after a state-changing payment action', async () => {
    const invalidate = vi.fn();
    const request = vi.fn(async (_path: string, _options?: HelioRequestOptions) => ({
      ack: 'ok',
    }));
    const api = createApi(
      {
        request: async <T>(path: string, options?: HelioRequestOptions) =>
          request(path, options) as unknown as Promise<T>,
      },
      { invalidate },
    );

    await expect(api.completeMockPayment('payment-1')).resolves.toEqual({ ack: 'ok' });

    expect(request).toHaveBeenCalledWith('/payments/payment-1/mock-complete', {
      method: 'POST',
    });
    expect(invalidate).toHaveBeenCalledWith([
      queryKeys.payments,
      queryKeys.orders,
      queryKeys.bills,
    ]);
  });
});

describe('authenticated API client', () => {
  it('adds the current access token as a Bearer authorization header', async () => {
    const sessions = createSessionStore(new MemoryStorage(), () => 'browser-device-1');
    sessions.saveSession({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      deviceId: 'browser-device-1',
    });
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createAuthenticatedClient({
      baseUrl: 'https://api.helio.test',
      fetch,
      sessions,
    });

    await client.request('/plants');

    const [, request] = fetch.mock.calls[0] ?? [];
    expect(new Headers(request?.headers).get('authorization')).toBe('Bearer access-token-1');
  });

  it('refreshes once after a 401 and retries with the rotated access token', async () => {
    const sessions = createSessionStore(new MemoryStorage(), () => 'browser-device-1');
    sessions.saveSession({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-1',
      deviceId: 'browser-device-1',
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'expired' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'rotated-access-token',
              refreshToken: 'rotated-refresh-token',
              expiresIn: 900,
              tokenType: 'Bearer',
            },
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'plant-1' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const client = createAuthenticatedClient({
      baseUrl: 'https://api.helio.test',
      fetch,
      sessions,
    });

    await expect(client.request('/plants')).resolves.toEqual([{ id: 'plant-1' }]);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1]?.[0]).toBe('https://api.helio.test/auth/refresh');
    expect(fetch.mock.calls[2]?.[0]).toBe('https://api.helio.test/plants');
    expect(new Headers(fetch.mock.calls[2]?.[1]?.headers).get('authorization')).toBe(
      'Bearer rotated-access-token',
    );
    expect(sessions.getSession()).toMatchObject({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
  });

  it('clears the session and stops after one retry when the refresh request fails', async () => {
    const sessions = createSessionStore(new MemoryStorage(), () => 'browser-device-1');
    sessions.saveSession({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token-1',
      deviceId: 'browser-device-1',
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'expired' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'refresh expired' }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'content-type': 'application/json' },
        }),
      );
    const client = createAuthenticatedClient({
      baseUrl: 'https://api.helio.test',
      fetch,
      sessions,
    });

    await expect(client.request('/plants')).rejects.toMatchObject({ status: 401 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sessions.getSession()).toBeNull();
  });
});
