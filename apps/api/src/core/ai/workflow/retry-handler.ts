import type { WorkflowError } from './types';

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

export function shouldRetry(
  error: WorkflowError,
  attempt: number,
  config?: Partial<RetryConfig>,
): boolean {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

  if (attempt >= cfg.maxAttempts) return false;
  if (error.retryable === false) return false;
  if (error.retryable === undefined) return false;

  return true;
}

export function getRetryDelay(attempt: number, config?: Partial<RetryConfig>): number {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };

  let delay = cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt);

  if (cfg.jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.min(delay, cfg.maxDelayMs);
}

export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  errorHandler: (err: unknown) => WorkflowError,
  config?: Partial<RetryConfig>,
): Promise<{ result: T | null; error: WorkflowError | null; attempts: number }> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: WorkflowError | null = null;

  for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, error: null, attempts: attempt + 1 };
    } catch (err) {
      lastError = errorHandler(err);

      if (!shouldRetry(lastError, attempt, cfg)) {
        return { result: null, error: lastError, attempts: attempt + 1 };
      }

      const delay = getRetryDelay(attempt, cfg);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { result: null, error: lastError, attempts: cfg.maxAttempts };
}
