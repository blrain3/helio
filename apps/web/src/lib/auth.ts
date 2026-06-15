import type { HelioClient, HelioRequestOptions } from '@helio/api-client';
import { unauthenticatedClient } from './api-client';
import { browserSessionStore, type SessionStore, type SessionUser } from './session';

export interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  user: SessionUser;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

interface AuthTransport {
  request<T>(path: string, options?: HelioRequestOptions): Promise<T>;
}

export function createAuth(client: AuthTransport | HelioClient, sessions: SessionStore) {
  return {
    async login(credentials: LoginCredentials): Promise<SessionUser> {
      const deviceId = sessions.getDeviceId();
      const result = await client.request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: {
          ...credentials,
          deviceId,
        },
      });

      sessions.saveSession({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        deviceId,
        user: result.user,
      });
      return result.user;
    },
  };
}

export const auth = createAuth(unauthenticatedClient, browserSessionStore);
