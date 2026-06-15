import { describe, expect, it, vi } from 'vitest';
import type { HelioRequestOptions } from '@helio/api-client';
import { createAuth } from './auth';
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

describe('session lifecycle', () => {
  it('persists the token pair returned by login and rehydrates it for the same device', async () => {
    const storage = new MemoryStorage();
    const sessions = createSessionStore(storage, () => 'browser-device-1');
    const request = vi.fn(async (_path: string, _options?: HelioRequestOptions) => ({
      user: {
        id: 'user-1',
        email: 'operator@helio.dev',
        role: 'OPERATOR',
      },
      tokens: {
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        expiresIn: 900,
        tokenType: 'Bearer',
      },
    }));
    const auth = createAuth(
      {
        request: async <T>(path: string, options?: HelioRequestOptions) =>
          request(path, options) as unknown as Promise<T>,
      },
      sessions,
    );

    await auth.login({
      email: 'operator@helio.dev',
      password: 'correct-horse-battery-staple',
    });

    expect(request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: {
        email: 'operator@helio.dev',
        password: 'correct-horse-battery-staple',
        deviceId: 'browser-device-1',
      },
    });
    expect(createSessionStore(storage, () => 'different-device').getSession()).toEqual({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      deviceId: 'browser-device-1',
      user: {
        id: 'user-1',
        email: 'operator@helio.dev',
        role: 'OPERATOR',
      },
    });
  });

  it('keeps one generated browser device ID across session-store instances', () => {
    const storage = new MemoryStorage();

    expect(createSessionStore(storage, () => 'browser-device-1').getDeviceId()).toBe(
      'browser-device-1',
    );
    expect(createSessionStore(storage, () => 'browser-device-2').getDeviceId()).toBe(
      'browser-device-1',
    );
  });
});
