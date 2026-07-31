import type { RetryPolicy, AIError } from '@devpilot/ai-providers';
import { DEFAULT_RETRY_POLICY } from '@devpilot/ai-providers';

export function calculateDelay(attempt: number, policy: RetryPolicy): number {
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(delay, policy.maxDelayMs);

  if (policy.jitter) {
    const jitterRange = cappedDelay * 0.3;
    return cappedDelay - jitterRange + Math.random() * jitterRange * 2;
  }

  return cappedDelay;
}

export function shouldRetry(error: unknown, attempt: number, policy: RetryPolicy): boolean {
  if (attempt >= policy.maxAttempts) return false;

  const aiError = error as Partial<AIError>;
  if (aiError.retryable === false) return false;
  if (aiError.code === 'AUTHENTICATION_ERROR') return false;
  if (aiError.code === 'INVALID_REQUEST') return false;
  if (aiError.code === 'MODEL_NOT_FOUND') return false;
  if (aiError.code === 'CONTEXT_LENGTH_EXCEEDED') return false;
  if (aiError.code === 'NOT_IMPLEMENTED') return false;

  return true;
}

export async function executeWithRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: Partial<RetryPolicy> = {},
): Promise<T> {
  const fullPolicy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, ...policy };
  let lastError: unknown;

  for (let attempt = 1; attempt <= fullPolicy.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error, attempt, fullPolicy)) {
        throw error;
      }

      const delay = calculateDelay(attempt, fullPolicy);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
