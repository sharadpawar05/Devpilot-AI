export const FREE_PLAN_LIMITS = {
  repositories: 3,
  healthScansPerMonth: 5,
  aiReportsPerMonth: 5,
  aiChatRequestsPerMonth: 20,
} as const;

export type PlanLimits = typeof FREE_PLAN_LIMITS;

export function getPlanLimits(_plan: string = 'free'): PlanLimits {
  // For now, only FREE plan exists
  return FREE_PLAN_LIMITS;
}

export function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
