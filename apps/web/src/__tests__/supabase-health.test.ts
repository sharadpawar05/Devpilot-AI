import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isAuthServiceReachable, AuthUnavailableError } from '@/lib/supabase-health';

vi.mock('@/lib/env', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test-project.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'anon-key',
  },
}));

describe('isAuthServiceReachable', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the auth health endpoint responds OK', async () => {
    fetchMock.mockResolvedValue({ ok: true });

    await expect(isAuthServiceReachable()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://test-project.supabase.co/auth/v1/health');
    expect(options.method).toBe('GET');
  });

  it('returns false when the endpoint responds with an error status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });

    await expect(isAuthServiceReachable()).resolves.toBe(false);
  });

  it('returns false when the request fails because the service is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(isAuthServiceReachable()).resolves.toBe(false);
  });

  it('returns false when the request times out', async () => {
    fetchMock.mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );

    await expect(isAuthServiceReachable(50)).resolves.toBe(false);
  });
});

describe('AuthUnavailableError', () => {
  it('is an Error with a stable name and default message', () => {
    const error = new AuthUnavailableError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AuthUnavailableError');
    expect(error.message).toBe('Authentication service is unavailable');
  });
});
