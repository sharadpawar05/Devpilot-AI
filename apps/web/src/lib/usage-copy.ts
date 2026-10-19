import type { UsageFeature } from '@/lib/api-error';

export interface UsageFeatureCopy {
  title: string;
  blurb: string;
  unit: (limit: number) => string;
}

export const FEATURE_COPY: Record<UsageFeature, UsageFeatureCopy> = {
  AI_REPORT: {
    title: 'Engineering report limit reached',
    blurb: 'Structured engineering reports generated from your repository data.',
    unit: (limit) => `Your plan includes ${limit} report${limit === 1 ? '' : 's'} per month.`,
  },
  REPOSITORIES: {
    title: 'Active repository limit reached',
    blurb: 'Repositories activated and used by DevPilot features.',
    unit: (limit) => `Your plan includes ${limit} active repositor${limit === 1 ? 'y' : 'ies'}.`,
  },
  HEALTH_SCAN: {
    title: 'Health scan limit reached',
    blurb: 'Repository health analyses for the current billing period.',
    unit: (limit) => `Your plan includes ${limit} health scan${limit === 1 ? '' : 's'} per month.`,
  },
  CHAT_MESSAGE: {
    title: 'Chat message limit reached',
    blurb: 'Messages sent from the Playground and from Repository Chat.',
    unit: (limit) => `Your plan includes ${limit} chat message${limit === 1 ? '' : 's'} per month.`,
  },
  AI_CREDITS: {
    title: 'AI credit limit reached',
    blurb: 'Overall AI usage budget for the current billing period.',
    unit: (limit) => `Your plan includes ${limit} AI credits per month.`,
  },
};

export function getUsageFeatureCopy(feature?: string): UsageFeatureCopy | undefined {
  if (!feature) return undefined;
  return FEATURE_COPY[feature as UsageFeature];
}
