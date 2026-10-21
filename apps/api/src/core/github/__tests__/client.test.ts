import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  githubFetch,
  createGitHubClient,
  GITHUB_REQUEST_TIMEOUT_MS,
  GITHUB_MAX_RETRIES,
} from '@/core/github/client';

const originalFetch = globalThis.fetch;

describe('githubFetch', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('applies the GitHub timeout bound when the caller supplies no signal', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response('ok'))) as typeof fetch;

    await githubFetch('https://api.github.com/user');

    expect(timeoutSpy).toHaveBeenCalledWith(GITHUB_REQUEST_TIMEOUT_MS);
    expect(GITHUB_REQUEST_TIMEOUT_MS).toBe(10_000);
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates the abort signal to the underlying fetch', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    const controller = new AbortController();
    globalThis.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          });
        }),
    ) as typeof fetch;

    const pending = githubFetch('https://api.github.com/user', { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });

    controller.abort();
    await assertion;

    // Caller-managed signal wins; AbortSignal.timeout is not consulted.
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('passes through a caller-supplied abort signal unchanged', async () => {
    const controller = new AbortController();
    const seen: RequestInit = {};
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      Object.assign(seen, init);
      return Promise.resolve(new Response('ok'));
    }) as typeof fetch;

    const response = await githubFetch('https://api.github.com/meta', {
      signal: controller.signal,
    });

    expect(seen.signal).toBe(controller.signal);
    expect(response.status).toBe(200);
  });

  it('resolves normally for a fast response', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response('ok', { status: 200 })),
    ) as typeof fetch;

    const response = await githubFetch('https://api.github.com/zen');
    expect(response.status).toBe(200);
  });
});

describe('createGitHubClient', () => {
  it('caps retries at the documented bound', () => {
    expect(GITHUB_MAX_RETRIES).toBe(2);
  });

  it('creates a working octokit client with the custom fetch', async () => {
    const client = createGitHubClient('ghp_test');
    expect(typeof client.request).toBe('function');

    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ) as typeof fetch;

    const response = await client.request('GET /zen');
    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.github.com/zen',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('does not echo the token in the client structure', () => {
    const client = createGitHubClient('ghp_verysecrettoken');
    const serialized = JSON.stringify(client);
    expect(serialized).not.toContain('ghp_verysecrettoken');
  });
});
