import { Octokit } from 'octokit';

/**
 * Bounds for outbound GitHub API traffic.
 *
 * - Timeout: octokit has no request timeout of its own, so a hung GitHub
 *   request would otherwise hold a socket (and a concurrency slot) forever.
 *   10s per attempt, applied through a fetch wrapper so *every* octokit call
 *   inherits it, including paginated ones.
 * - Retries: octokit's bundled retry plugin defaults to 3 retries with
 *   1s/4s/9s backoff. We cap it at 2 retries (3 attempts) with 0.5s/2s
 *   backoff so worst-case GitHub latency per logical call is bounded at
 *   ~32s (3 × 10s + 2.5s backoff). Non-retryable statuses (400, 401, 403,
 *   404, 410, 422, 451) are never retried by the plugin.
 * - Concurrency: octokit's bundled throttling plugin already caps global
 *   concurrency at 10 requests with rate-limit backoff — that is the
 *   application's GitHub concurrency limit.
 */
export const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
export const GITHUB_MAX_RETRIES = 2;
export const GITHUB_RETRY_BASE_MS = 500;

/** fetch implementation that enforces a per-request timeout unless the
 * caller supplied its own abort signal. */
export function githubFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS);
  return fetch(input as RequestInfo, { ...init, signal });
}

/** Creates an octokit client with bounded timeout/retry behavior. */
export function createGitHubClient(token: string): Octokit {
  return new Octokit({
    auth: token,
    request: { fetch: githubFetch },
    retry: {
      retries: GITHUB_MAX_RETRIES,
      retryAfterBaseValue: GITHUB_RETRY_BASE_MS,
    },
  });
}
