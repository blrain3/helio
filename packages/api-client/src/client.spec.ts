import { describe, expect, it, vi } from 'vitest';
import { ApiError, createHelioClient } from './client';

describe('createHelioClient', () => {
  it('sends bearer credentials and a JSON body to the requested endpoint', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'plant-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = createHelioClient({
      baseUrl: 'https://api.helio.test/api/',
      accessToken: () => 'access-token',
      fetch: fetchImpl as unknown as typeof fetch,
    });

    const result = await client.request<{ id: string }>('/plants', {
      method: 'POST',
      body: { name: '南站', capacity: 600 },
    });

    expect(result).toEqual({ id: 'plant-1' });
    const [url, options] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe('https://api.helio.test/api/plants');
    expect(options).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: '南站', capacity: 600 }),
    });
    expect(new Headers(options?.headers).get('authorization')).toBe(
      'Bearer access-token',
    );
    expect(new Headers(options?.headers).get('content-type')).toBe(
      'application/json',
    );
  });

  it('normalizes a failed API response into ApiError', async () => {
    const client = createHelioClient({
      baseUrl: 'https://api.helio.test/api',
      fetch: vi.fn(async () =>
        new Response(
          JSON.stringify({
            statusCode: 403,
            code: 'FORBIDDEN',
            message: '无权访问该资源',
          }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ) as unknown as typeof fetch,
    });

    await expect(client.request('/plants/plant-1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN',
      message: '无权访问该资源',
    } satisfies Partial<ApiError>);
  });
});
