export interface PlanLimits {
  repositories: number;
  aiCredits: number;
  healthScans: number;
  aiReports: number;
  chatMessages: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  FREE: {
    repositories: 1,
    aiCredits: 50,
    healthScans: 2,
    aiReports: 2,
    chatMessages: 20,
  },
  STARTER: {
    repositories: 3,
    aiCredits: 500,
    healthScans: 10,
    aiReports: 20,
    chatMessages: 100,
  },
  PRO: {
    repositories: 10,
    aiCredits: 1500,
    healthScans: 30,
    aiReports: 60,
    chatMessages: 300,
  },
  ENTERPRISE: {
    repositories: 25,
    aiCredits: 5000,
    healthScans: 100,
    aiReports: 200,
    chatMessages: 1000,
  },
};

export const FREE_PLAN_LIMITS = PLAN_LIMITS.FREE;

export type UsageFeature =
  'REPOSITORIES' | 'HEALTH_SCAN' | 'AI_REPORT' | 'CHAT_MESSAGE' | 'AI_CREDITS';

export function getPlanLimits(plan?: string | null): PlanLimits {
  if (plan && PLAN_LIMITS[plan]) {
    return PLAN_LIMITS[plan];
  }
  return PLAN_LIMITS.FREE;
}

export function getLimitForFeature(limits: PlanLimits, feature: UsageFeature): number {
  switch (feature) {
    case 'REPOSITORIES':
      return limits.repositories;
    case 'HEALTH_SCAN':
      return limits.healthScans;
    case 'AI_REPORT':
      return limits.aiReports;
    case 'CHAT_MESSAGE':
      return limits.chatMessages;
    case 'AI_CREDITS':
      return limits.aiCredits;
  }
}

/**
 * Current UTC month period. periodStart = first day of current UTC month,
 * periodEnd = first day of next UTC month.
 */
export function getCurrentMonthPeriod(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}

/** Legacy YYYY-MM string form (kept for backward-compatible helpers). */
export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
