import type { FastifyRequest, FastifyBaseLogger } from 'fastify';
import { backgroundJobsTotal } from '@/core/metrics';
import { runWithContext, getRequestContext, getCurrentRequestId } from './context';

export interface BackgroundJobContext {
  /** Correlation ID of the request that scheduled the job. */
  requestId: string;
  /** Stable job name (metric label) — e.g. `repository-index`. */
  job: string;
  /** Request-scoped child logger: requestId + job bindings already applied. */
  log: FastifyBaseLogger;
}

/** Context of the background job currently running, if any. */
export function getBackgroundJobContext(): { requestId: string; job: string } | undefined {
  const store = getRequestContext();
  return store?.job ? { requestId: store.requestId, job: store.job } : undefined;
}

/** Correlation ID for the current request/job, when one exists. */
export function getCurrentCorrelationId(): string | undefined {
  return getCurrentRequestId();
}

export interface RunBackgroundJobOptions {
  /** Invoked after the job function throws (e.g. to mark a record FAILED). */
  onError?: (error: unknown, context: BackgroundJobContext) => void | Promise<void>;
}

/**
 * Runs fire-and-forget work started from an HTTP request with full log
 * correlation:
 *
 * - the job runs inside the request's AsyncLocalStorage context, so logs
 *   emitted deep in the job chain (via `rootLogger`) resolve the originating
 *   request ID;
 * - the job gets a child logger bound to `{ requestId, job }`;
 * - failures are logged (redacted by the pino formatters) and counted in
 *   `background_jobs_total{job,outcome}`;
 * - the returned promise never rejects, so an unhandled rejection cannot
 *   crash the process — use `onError` for cleanup such as marking an index
 *   record FAILED.
 *
 * The promise is intentionally not awaited by callers; the job keeps running
 * after the response is sent.
 */
export function runBackgroundJob<T>(
  request: FastifyRequest,
  job: string,
  fn: (context: BackgroundJobContext) => Promise<T>,
  options: RunBackgroundJobOptions = {},
): Promise<void> {
  const context: BackgroundJobContext = {
    requestId: request.id,
    job,
    // `request.log` already carries the requestId binding; add the job name.
    // (Route tests pass stub loggers without `child()` — fall back to the
    // stub so the job still runs.)
    log: typeof request.log.child === 'function' ? request.log.child({ job }) : request.log,
  };

  return runWithContext({ requestId: request.id, job }, async () => {
    try {
      await fn(context);
      backgroundJobsTotal.inc({ job, outcome: 'success' });
    } catch (error) {
      backgroundJobsTotal.inc({ job, outcome: 'error' });
      context.log.error({ err: error }, 'Background job failed');
      if (options.onError) {
        try {
          await options.onError(error, context);
        } catch (cleanupError) {
          context.log.error({ err: cleanupError }, 'Background job error handler failed');
        }
      }
    }
  });
}
