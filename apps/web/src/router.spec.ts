import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
  let listener: (() => void) | undefined;
  const getSession = vi.fn();
  const queryClear = vi.fn();
  const revalidate = vi.fn();
  const render = vi.fn();
  const configureApiInvalidation = vi.fn();

  return {
    getSession,
    queryClear,
    revalidate,
    render,
    configureApiInvalidation,
    browserSessionStore: {
      getSession,
      subscribe: vi.fn((next: () => void) => {
        listener = next;
        return vi.fn();
      }),
      clearSession: () => {
        getSession.mockReturnValue(null);
        listener?.();
      },
    },
    reset: () => {
      listener = undefined;
      getSession.mockReset();
      queryClear.mockReset();
      revalidate.mockReset();
      render.mockReset();
      configureApiInvalidation.mockReset();
    },
  };
});

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: testState.render })),
}));

vi.mock('@tanstack/react-query', () => ({
  QueryClient: class {
    invalidateQueries = vi.fn();
    clear = testState.queryClear;
  },
  QueryClientProvider: ({ children }: { children?: unknown }) => children,
}));

vi.mock('react-router', () => ({
  RouterProvider: () => null,
}));

vi.mock('./router', () => ({
  router: { revalidate: testState.revalidate },
}));

vi.mock('./lib/api', () => ({
  configureApiInvalidation: testState.configureApiInvalidation,
}));

vi.mock('./lib/session', () => ({
  browserSessionStore: testState.browserSessionStore,
}));

describe('protected-route session revalidation', () => {
  beforeEach(async () => {
    vi.resetModules();
    testState.reset();
    testState.getSession.mockReturnValue({ accessToken: 'access-token' });
    vi.stubGlobal('document', { getElementById: vi.fn(() => ({})) });

    await import('./main');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('revalidates the existing protected-route guard when a session is cleared', () => {
    testState.browserSessionStore.clearSession();

    expect(testState.queryClear).toHaveBeenCalledTimes(1);
    expect(testState.revalidate).toHaveBeenCalledTimes(1);
  });
});
