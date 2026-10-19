import { describe, it, expect } from 'vitest';
import {
  Semaphore,
  AIOverloadedError,
  DEFAULT_AI_MAX_CONCURRENT,
  DEFAULT_AI_MAX_QUEUE,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  getStreamIdleTimeoutMs,
} from '@/core/ai/concurrency';
import { classifyAIError } from '@/core/ai/classify-error';

describe('Semaphore', () => {
  it('admits up to maxConcurrent immediately', async () => {
    const semaphore = new Semaphore(2, 0, 50);
    await semaphore.acquire();
    await semaphore.acquire();
    expect(semaphore.inFlight).toBe(2);
  });

  it('queues waiters up to maxQueue and hands slots over on release', async () => {
    const semaphore = new Semaphore(1, 1, 1_000);
    await semaphore.acquire();

    let admitted = false;
    const waiting = semaphore.acquire().then(() => {
      admitted = true;
    });

    expect(semaphore.queued).toBe(1);
    semaphore.release();
    await waiting;
    expect(admitted).toBe(true);
    expect(semaphore.inFlight).toBe(1);
  });

  it('fails fast with AIOverloadedError when the queue is full', async () => {
    const semaphore = new Semaphore(1, 1, 1_000);
    await semaphore.acquire();

    const waiter = semaphore.acquire();
    expect(semaphore.queued).toBe(1);

    await expect(semaphore.acquire()).rejects.toBeInstanceOf(AIOverloadedError);
    semaphore.release();
    await waiter;
  });

  it('rejects a waiter whose wait exceeds the timeout', async () => {
    const semaphore = new Semaphore(1, 1, 20);
    await semaphore.acquire();

    await expect(semaphore.acquire()).rejects.toMatchObject({
      code: 'AI_OVERLOADED',
      statusCode: 503,
    });
    expect(semaphore.queued).toBe(0);
  });

  it('decrements active slots when no waiter is queued', async () => {
    const semaphore = new Semaphore(1, 0, 20);
    await semaphore.acquire();
    semaphore.release();
    expect(semaphore.inFlight).toBe(0);
  });
});

describe('AIOverloadedError', () => {
  it('is a client-safe 503 with a stable code', () => {
    const error = new AIOverloadedError();
    expect(error.code).toBe('AI_OVERLOADED');
    expect(error.statusCode).toBe(503);
    expect(error.expose).toBe(true);
    expect(error.retryable).toBe(true);

    const classified = classifyAIError(error);
    expect(classified.status).toBe(503);
    expect(classified.code).toBe('AI_OVERLOADED');
    expect(classified.message).toBe('The AI service is at capacity. Please try again in a moment.');
  });
});

describe('stream idle timeout env', () => {
  it('defaults to 60s when unset', () => {
    const original = process.env.AI_STREAM_IDLE_TIMEOUT_MS;
    delete process.env.AI_STREAM_IDLE_TIMEOUT_MS;
    try {
      expect(getStreamIdleTimeoutMs()).toBe(DEFAULT_STREAM_IDLE_TIMEOUT_MS);
    } finally {
      if (original !== undefined) process.env.AI_STREAM_IDLE_TIMEOUT_MS = original;
    }
  });

  it('honors a valid override and ignores garbage', () => {
    const original = process.env.AI_STREAM_IDLE_TIMEOUT_MS;
    try {
      process.env.AI_STREAM_IDLE_TIMEOUT_MS = '5000';
      expect(getStreamIdleTimeoutMs()).toBe(5_000);

      process.env.AI_STREAM_IDLE_TIMEOUT_MS = 'not-a-number';
      expect(getStreamIdleTimeoutMs()).toBe(DEFAULT_STREAM_IDLE_TIMEOUT_MS);

      process.env.AI_STREAM_IDLE_TIMEOUT_MS = '1';
      expect(getStreamIdleTimeoutMs()).toBe(DEFAULT_STREAM_IDLE_TIMEOUT_MS);
    } finally {
      if (original === undefined) delete process.env.AI_STREAM_IDLE_TIMEOUT_MS;
      else process.env.AI_STREAM_IDLE_TIMEOUT_MS = original;
    }
  });
});

describe('AI concurrency defaults', () => {
  it('are bounded', () => {
    expect(DEFAULT_AI_MAX_CONCURRENT).toBeGreaterThan(0);
    expect(DEFAULT_AI_MAX_CONCURRENT).toBeLessThanOrEqual(64);
    expect(DEFAULT_AI_MAX_QUEUE).toBeLessThanOrEqual(1000);
  });
});
