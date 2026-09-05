import { useSyncExternalStore } from 'react';

const SESSION_STORAGE_KEY = 'helio.session';
const DEVICE_STORAGE_KEY = 'helio.device-id';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  user?: SessionUser;
}

export interface SessionStore {
  getSession(): SessionData | null;
  saveSession(session: SessionData): void;
  clearSession(): void;
  getDeviceId(): string;
  subscribe(listener: () => void): () => void;
}

class InMemoryStorage implements StorageLike {
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

export function createSessionStore(
  storage: StorageLike,
  createDeviceId: () => string = defaultDeviceId,
): SessionStore {
  let current = readSession(storage);
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSession: () => current,
    saveSession(session) {
      current = session;
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      storage.setItem(DEVICE_STORAGE_KEY, session.deviceId);
      notify();
    },
    clearSession() {
      current = null;
      storage.removeItem(SESSION_STORAGE_KEY);
      notify();
    },
    getDeviceId() {
      const existing = storage.getItem(DEVICE_STORAGE_KEY);
      if (existing) {
        return existing;
      }

      const deviceId = createDeviceId();
      storage.setItem(DEVICE_STORAGE_KEY, deviceId);
      return deviceId;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function readSession(storage: StorageLike): SessionData | null {
  const stored = storage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<SessionData>;
    if (
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      typeof parsed.deviceId === 'string'
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        deviceId: parsed.deviceId,
        ...(parsed.user ? { user: parsed.user } : {}),
      };
    }
  } catch {
    // A malformed local value is not an authenticated session.
  }

  storage.removeItem(SESSION_STORAGE_KEY);
  return null;
}

function defaultDeviceId(): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `web:${randomId}` : `web:${Date.now()}:${Math.random()}`;
}

function browserStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new InMemoryStorage();
}

export const browserSessionStore = createSessionStore(browserStorage());

export function useSession() {
  const session = useSyncExternalStore(
    browserSessionStore.subscribe,
    browserSessionStore.getSession,
    () => null,
  );

  return {
    session,
    isAuthenticated: session !== null,
    clearSession: browserSessionStore.clearSession,
  };
}
