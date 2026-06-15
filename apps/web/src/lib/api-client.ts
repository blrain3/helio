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
  let refreshInFlight:
    | { refreshToken: string; promise: Promise<void> }
    | undefined;
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
      const session = options.sessions.getSession();
      try {
        return await authenticatedClient.request<T>(path, requestOptions);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || path === '/auth/refresh') {
          throw error;
        }

        if (!session) {
          throw error;
        }

        await refreshSession(session);

        return authenticatedClient.request<T>(path, requestOptions);
      }
    },
  };

  async function refreshSession(session: SessionData): Promise<void> {
    if (!holdsRefreshToken(session.refreshToken)) {
      return;
    }

    let inFlight = refreshInFlight;
    if (!inFlight || inFlight.refreshToken !== session.refreshToken) {
      inFlight = {
        refreshToken: session.refreshToken,
        promise: Promise.resolve(),
      };
      inFlight.promise = requestRefresh(session).finally(() => {
        if (refreshInFlight === inFlight) {
          refreshInFlight = undefined;
        }
      });
      refreshInFlight = inFlight;
    }

    try {
      await inFlight.promise;
    } catch (error) {
      if (holdsRefreshToken(session.refreshToken)) {
        options.sessions.clearSession();
      }
      throw error;
    }
  }

  async function requestRefresh(session: SessionData): Promise<void> {
    const refreshed = await publicClient.request<TokenPairResponse>('/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken: session.refreshToken,
        deviceId: session.deviceId,
      },
    });
    const current = options.sessions.getSession();
    if (current?.refreshToken === session.refreshToken) {
      options.sessions.saveSession(withTokens(current, refreshed.tokens));
    }
  }

  function holdsRefreshToken(refreshToken: string): boolean {
    return options.sessions.getSession()?.refreshToken === refreshToken;
  }
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
