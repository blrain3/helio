import {
  ApiError,
  createHelioClient,
  type HelioClient,
  type HelioRequestOptions,
} from '@helio/api-client';
import { browserSessionStore, type SessionData, type SessionStore } from './session';

export interface AuthenticatedClientOptions {
  baseUrl: string;
  sessions: SessionStore;
  fetch?: typeof fetch;
}

interface TokenPairResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export function createAuthenticatedClient(
  options: AuthenticatedClientOptions,
): HelioClient {
  const publicClient = createHelioClient({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
  });
  const authenticatedClient = createHelioClient({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    accessToken: () => options.sessions.getSession()?.accessToken,
  });

  return {
    async request<T>(path: string, requestOptions: HelioRequestOptions = {}): Promise<T> {
      try {
        return await authenticatedClient.request<T>(path, requestOptions);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || path === '/auth/refresh') {
          throw error;
        }

        const session = options.sessions.getSession();
        if (!session) {
          throw error;
        }

        try {
          const refreshed = await publicClient.request<TokenPairResponse>('/auth/refresh', {
            method: 'POST',
            body: {
              refreshToken: session.refreshToken,
              deviceId: session.deviceId,
            },
          });
          options.sessions.saveSession(withTokens(session, refreshed.tokens));
        } catch (refreshError) {
          options.sessions.clearSession();
          throw refreshError;
        }

        return authenticatedClient.request<T>(path, requestOptions);
      }
    },
  };
}

function withTokens(
  session: SessionData,
  tokens: TokenPairResponse['tokens'],
): SessionData {
  return {
    ...session,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const unauthenticatedClient = createHelioClient({ baseUrl });
export const authenticatedClient = createAuthenticatedClient({
  baseUrl,
  sessions: browserSessionStore,
});
