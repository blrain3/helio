export interface ApiErrorPayload {
  statusCode?: number;
  code?: string;
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HelioRequestOptions
  extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: HeadersInit;
}

export interface HelioClient {
  request<T>(path: string, options?: HelioRequestOptions): Promise<T>;
}

export interface HelioClientOptions {
  baseUrl: string;
  accessToken?: string | null | (() => string | null | undefined);
  fetch?: typeof fetch;
}

export function createHelioClient(options: HelioClientOptions): HelioClient {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('当前运行环境不支持 fetch');
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '');

  return {
    async request<T>(path: string, requestOptions: HelioRequestOptions = {}) {
      const headers = new Headers(requestOptions.headers);
      headers.set('accept', 'application/json');

      const accessToken = resolveAccessToken(options.accessToken);
      if (accessToken) {
        headers.set('authorization', `Bearer ${accessToken}`);
      }

      let body: BodyInit | undefined;
      if (requestOptions.body !== undefined) {
        headers.set('content-type', 'application/json');
        body = JSON.stringify(requestOptions.body);
      }

      let response: Response;
      try {
        response = await fetchImpl(joinUrl(baseUrl, path), {
          ...requestOptions,
          headers,
          body,
        });
      } catch (error) {
        throw new ApiError(
          error instanceof Error ? error.message : '网络请求失败',
          0,
          'NETWORK_ERROR',
        );
      }

      const payload = await readResponsePayload(response);
      if (!response.ok) {
        const errorPayload = isApiErrorPayload(payload) ? payload : undefined;
        throw new ApiError(
          errorMessage(errorPayload?.message, response.statusText),
          response.status,
          errorPayload?.code ?? 'HTTP_ERROR',
          payload,
        );
      }

      return payload as T;
    },
  };
}

function resolveAccessToken(
  accessToken: HelioClientOptions['accessToken'],
): string | null | undefined {
  return typeof accessToken === 'function' ? accessToken() : accessToken;
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

async function readResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  if (response.headers.get('content-type')?.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return text;
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return typeof payload === 'object' && payload !== null;
}

function errorMessage(message: ApiErrorPayload['message'], fallback: string): string {
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return message || fallback || '请求失败';
}
