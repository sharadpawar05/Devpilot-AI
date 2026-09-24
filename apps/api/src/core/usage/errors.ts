import type { FastifyReply } from 'fastify';
import type { UsageFeature } from './plan-limits';

export interface UsageLimitErrorDetails {
  feature: UsageFeature;
  used: number;
  limit: number;
  resetAt: Date;
}

/**
 * Shared USAGE_LIMIT_REACHED error using the existing API error envelope.
 * Extends `error` with machine-readable feature/used/limit/resetAt fields.
 */
export function sendUsageLimitReached(
  reply: FastifyReply,
  details: UsageLimitErrorDetails,
): FastifyReply {
  const featureLabel = details.feature
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return reply.status(403).send({
    success: false,
    error: {
      code: 'USAGE_LIMIT_REACHED',
      message: `You have reached your ${featureLabel} limit (${details.used}/${details.limit}). Upgrade your plan or wait until the next billing period.`,
      feature: details.feature,
      used: details.used,
      limit: details.limit,
      resetAt: details.resetAt.toISOString(),
    },
  });
}
