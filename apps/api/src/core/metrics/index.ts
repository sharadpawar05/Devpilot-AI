import { Counter, Gauge, Histogram, registry } from './registry';

export { Counter, Gauge, Histogram, MetricsRegistry, registry } from './registry';
export type { Labels, HistogramSnapshot } from './registry';

/**
 * Application metric instances.
 *
 * Every label below is drawn from a bounded, fixed set (HTTP method, route
 * template, status code, provider name, feature key, job name). User IDs,
 * repository names, prompts and error messages are never used as labels.
 */

/** Total HTTP requests handled, by method/route-template/status. */
export const httpRequestsTotal = registry.register(
  new Counter('http_requests_total', 'Total HTTP requests by method, route and status code.'),
);

/** HTTP request latency in seconds, by method/route-template. */
export const httpRequestDurationSeconds = registry.register(
  new Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds by method and route.',
    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ),
);

/** AI provider calls by provider and outcome (success|error). */
export const aiRequestsTotal = registry.register(
  new Counter('ai_requests_total', 'AI provider calls by provider and outcome.'),
);

/** AI provider call latency in seconds, by provider. */
export const aiRequestDurationSeconds = registry.register(
  new Histogram(
    'ai_request_duration_seconds',
    'AI provider call latency in seconds.',
    [0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120],
  ),
);

/** AI requests currently holding a concurrency slot. */
export const aiRequestsInFlight = registry.register(
  new Gauge('ai_requests_in_flight', 'AI provider calls currently executing.'),
);

/** AI tokens consumed, by feature. */
export const aiTokensTotal = registry.register(
  new Counter('ai_tokens_total', 'AI tokens consumed by feature (input + output).'),
);

/** AI credits consumed, by feature. */
export const aiCreditsConsumedTotal = registry.register(
  new Counter('ai_credits_consumed_total', 'AI credits consumed by feature.'),
);

/** AI credits refunded after failed provider calls, by feature. */
export const aiCreditsRefundedTotal = registry.register(
  new Counter('ai_credits_refunded_total', 'AI credits refunded after failed calls, by feature.'),
);

/** Estimated provider cost in USD, by feature. */
export const aiEstimatedCostUsdTotal = registry.register(
  new Counter(
    'ai_estimated_cost_usd_total',
    'Estimated AI provider cost in USD by feature (from recorded usage events).',
  ),
);

/** Background jobs started, by job name and outcome (success|error). */
export const backgroundJobsTotal = registry.register(
  new Counter('background_jobs_total', 'Background jobs by name and outcome.'),
);

/**
 * Resolved the request route template for metric labels.
 *
 * Matched routes use Fastify's route pattern (`/api/v1/repo/:owner/:repo`),
 * which is a bounded set. Unmatched routes (404s) collapse to a single
 * `unmatched` label so a path-scanning client can never explode cardinality.
 */
export function resolveRouteLabel(routeUrl: string | undefined): string {
  return routeUrl ?? 'unmatched';
}
