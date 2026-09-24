import type { FastifyReply } from 'fastify';
import type { UsageFeature } from './plan-limits';

export interface UsageLimitErrorDetails {
  feature: UsageFeature;
  used: number;
  limit: number;
  resetAt: Date;
}

const FEATURE_MESSAGES: Record<UsageFeature, (d: UsageLimitErrorDetails) => string> = {
  AI_REPORT: (d) =>
    `Engineering report limit reached. Your plan includes ${d.limit} reports per month. Upgrade to generate more reports.`,
  REPOSITORIES: (d) =>
    `Your plan includes ${d.limit} active repository. Upgrade to use another repository.`,
  HEALTH_SCAN: (d) =>
    `Health scan limit reached. Your plan includes ${d.limit} scans per month. Upgrade or wait until reset.`,
  CHAT_MESSAGE: (d) =>
    `Repository chat limit reached. Your plan includes ${d.limit} messages per month. Upgrade or wait until reset.`,
  AI_CREDITS: (d) =>
    `AI credit limit reached. Your plan includes ${d.limit} credits per month. Upgrade or wait until reset.`,
};

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

  const message =
    FEATURE_MESSAGES[details.feature]?.(details) ??
    `You have reached your ${featureLabel} limit (${details.used}/${details.limit}). Upgrade your plan or wait until the next billing period.`;

  return reply.status(403).send({
    success: false,
    error: {
      code: 'USAGE_LIMIT_REACHED',
      message,
      feature: details.feature,
      used: details.used,
      limit: details.limit,
      resetAt: details.resetAt.toISOString(),
    },
  });
}
