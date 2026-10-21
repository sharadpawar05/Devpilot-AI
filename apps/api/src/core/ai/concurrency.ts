import { aiRequestsInFlight } from '@/core/metrics';

/**
 * Bounded concurrency for outbound AI calls.
 *
 * Without this, every inbound request could start its own provider call (each
 * with up to 3 attempts across a 5-provider fallback chain), so a burst of
 * traffic turns into hundreds of simultaneous upstream calls and unbounded
 * memory growth. The semaphore caps simultaneous provider work and bounds the
 * wait queue; callers past the bound fail fast with `AI_OVERLOADED` (HTTP
 * 503) instead of piling up.
 *
 * Env overrides (validated by the env schema):
 * - `AI_MAX_CONCURRENT` (default 4)  — simultaneous provider calls
 * - `AI_MAX_QUEUE` (default 16)      — requests allowed to wait for a slot
 * - `AI_QUEUE_TIMEOUT_MS` (default 30000) — max wait before AI_OVERLOADED
 */

export const DEFAULT_AI_MAX_CONCURRENT = 4;
export const DEFAULT_AI_MAX_QUEUE = 16;
export const DEFAULT_AI_QUEUE_TIMEOUT_MS = 30_000;

/** Thrown when the AI concurrency queue is full or a slot wait timed out. */
export class AIOverloadedError extends Error {
  readonly code = 'AI_OVERLOADED';
  readonly retryable = true;
  readonly statusCode = 503;
  /** Lets the Fastify error handler return this message to the client as-is. */
  readonly expose = true;

  constructor(message = 'The AI service is at capacity. Please try again in a moment.') {
    super(message);
    this.name = 'AIOverloadedError';
  }
}

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return fallback;
  return Math.trunc(value);
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class Semaphore {
  private active = 0;
  private queue: Waiter[] = [];

  constructor(
    readonly maxConcurrent: number,
    readonly maxQueue: number,
    readonly waitTimeoutMs: number,
  ) {}

  get inFlight(): number {
    return this.active;
  }

  get queued(): number {
    return this.queue.length;
  }

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }
    if (this.queue.length >= this.maxQueue) {
      throw new AIOverloadedError();
    }
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.queue.indexOf(waiter);
          if (index !== -1) this.queue.splice(index, 1);
          reject(new AIOverloadedError());
        }, this.waitTimeoutMs),
      };
      // Do not keep the process alive just because a waiter is queued.
      waiter.timer.unref?.();
      this.queue.push(waiter);
    });
    // Slot handed over by release(); `active` is unchanged.
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
      return;
    }
    this.active = Math.max(0, this.active - 1);
  }
}

function buildSemaphore(): Semaphore {
  return new Semaphore(
    intFromEnv('AI_MAX_CONCURRENT', DEFAULT_AI_MAX_CONCURRENT, 1, 64),
    intFromEnv('AI_MAX_QUEUE', DEFAULT_AI_MAX_QUEUE, 0, 1000),
    intFromEnv('AI_QUEUE_TIMEOUT_MS', DEFAULT_AI_QUEUE_TIMEOUT_MS, 100, 300_000),
  );
}

/** Process-wide AI concurrency gate. */
export const aiSemaphore = buildSemaphore();

/** Runs `fn` while holding an AI concurrency slot; always releases it. */
export async function withAiConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  await aiSemaphore.acquire();
  aiRequestsInFlight.inc();
  try {
    return await fn();
  } finally {
    aiRequestsInFlight.dec();
    aiSemaphore.release();
  }
}

/**
 * Idle deadline for streaming responses: if the provider stops producing
 * chunks for `idleTimeoutMs`, the stream is terminated (the underlying
 * iterator is closed, which propagates cancellation best-effort) and an
 * error chunk is emitted.
 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 60_000;

export function getStreamIdleTimeoutMs(): number {
  return intFromEnv('AI_STREAM_IDLE_TIMEOUT_MS', DEFAULT_STREAM_IDLE_TIMEOUT_MS, 1_000, 600_000);
}
