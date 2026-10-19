import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Request/job correlation context.
 *
 * Entered in the request logger's `onRequest` hook, so everything that runs
 * during a request — route handlers, caught errors, background jobs launched
 * from the request — can resolve the originating request ID even when it runs
 * on a module-level logger (`rootLogger`) that has no per-request binding.
 *
 * Empirically verified against Fastify v4: `enterWith` in an `onRequest` hook
 * propagates through route handlers, deep `await` chains and the error
 * handler.
 */
export interface RequestContext {
  requestId: string;
  /** Set while a background job launched from this request is running. */
  job?: string;
  jobId?: string;
}

const requestStorage = new AsyncLocalStorage<RequestContext>();

export function enterRequestContext(requestId: string): void {
  requestStorage.enterWith({ requestId });
}

/** Runs `fn` with a background-job context layered over the current request. */
export function runWithContext<R>(context: RequestContext, fn: () => R): R {
  const parent = requestStorage.getStore();
  return requestStorage.run({ ...parent, ...context }, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestStorage.getStore();
}

export function getCurrentRequestId(): string | undefined {
  return requestStorage.getStore()?.requestId;
}
