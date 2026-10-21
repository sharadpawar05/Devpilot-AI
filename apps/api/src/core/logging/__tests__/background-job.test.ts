import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import {
  runBackgroundJob,
  getBackgroundJobContext,
  getCurrentCorrelationId,
} from '@/core/logging/background-job';
import { getCurrentRequestId } from '@/core/logging/context';
import { backgroundJobsTotal } from '@/core/metrics';

function makeRequest(overrides: { id?: string; log?: Record<string, unknown> } = {}) {
  return {
    id: overrides.id ?? 'req-123',
    log: overrides.log ?? {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    },
  } as unknown as FastifyRequest;
}

describe('runBackgroundJob', () => {
  it('runs the job with the originating request ID in async context', async () => {
    const request = makeRequest();
    let requestIdInside: string | undefined;
    let jobIdInside: string | undefined;

    await runBackgroundJob(request, 'repository-index', async (ctx) => {
      requestIdInside = getCurrentRequestId();
      jobIdInside = getBackgroundJobContext()?.job;
      expect(ctx.requestId).toBe('req-123');
      expect(ctx.job).toBe('repository-index');
    });

    expect(requestIdInside).toBe('req-123');
    expect(jobIdInside).toBe('repository-index');
    expect(getCurrentRequestId()).toBeUndefined();
    expect(getCurrentCorrelationId()).toBeUndefined();
  });

  it('creates a child logger bound to the job name when available', async () => {
    const child = vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
    const request = makeRequest({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), child } });

    let loggerSeen: { error?: unknown } | undefined;
    await runBackgroundJob(request, 'repository-reindex', async (ctx) => {
      loggerSeen = ctx.log;
    });

    expect(child).toHaveBeenCalledWith({ job: 'repository-reindex' });
    expect(loggerSeen).toBeDefined();
  });

  it('falls back to request.log when the stub logger has no child()', async () => {
    const error = vi.fn();
    const request = makeRequest({ log: { error } });

    let loggerSeen: unknown;
    await runBackgroundJob(request, 'no-child', async (ctx) => {
      loggerSeen = ctx.log;
    });

    expect(loggerSeen).toBe(request.log);
  });

  it('counts successful jobs and never rejects', async () => {
    const before = backgroundJobsTotal.get({ job: 'test-ok', outcome: 'success' });
    const request = makeRequest();

    await expect(runBackgroundJob(request, 'test-ok', async () => 'done')).resolves.toBeUndefined();

    expect(backgroundJobsTotal.get({ job: 'test-ok', outcome: 'success' })).toBe(before + 1);
  });

  it('swallows failures, logs them, counts them, and invokes onError', async () => {
    const request = makeRequest();
    const failure = new Error('index blew up with token ghp_1234567890abcdefghij');
    const onError = vi.fn();
    const errorBefore = backgroundJobsTotal.get({ job: 'test-fail', outcome: 'error' });

    await expect(
      runBackgroundJob(
        request,
        'test-fail',
        async () => {
          throw failure;
        },
        { onError },
      ),
    ).resolves.toBeUndefined();

    expect(backgroundJobsTotal.get({ job: 'test-fail', outcome: 'error' })).toBe(errorBefore + 1);
    expect(onError).toHaveBeenCalledWith(failure, expect.objectContaining({ job: 'test-fail' }));
  });

  it('does not let a throwing onError handler reject the job promise', async () => {
    const childError = vi.fn();
    const childLogger = { info: vi.fn(), warn: vi.fn(), error: childError };
    const request = makeRequest({
      log: { error: vi.fn(), child: vi.fn(() => childLogger) },
    });
    const onError = vi.fn(() => {
      throw new Error('cleanup failed');
    });

    await expect(
      runBackgroundJob(
        request,
        'test-onerror',
        async () => {
          throw new Error('boom');
        },
        { onError },
      ),
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalled();
    // The cleanup failure is logged on the child logger, not thrown.
    expect(childError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Background job error handler failed',
    );
  });

  it('keeps context isolated between concurrent jobs', async () => {
    const seen: Record<string, string | undefined> = {};
    const first = runBackgroundJob(makeRequest({ id: 'req-a' }), 'job-a', async () => {
      await new Promise((r) => setTimeout(r, 10));
      seen.a = getCurrentRequestId();
    });
    const second = runBackgroundJob(makeRequest({ id: 'req-b' }), 'job-b', async () => {
      seen.b = getCurrentRequestId();
    });
    await Promise.all([first, second]);

    expect(seen.a).toBe('req-a');
    expect(seen.b).toBe('req-b');
  });
});
