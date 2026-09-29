/**
 * Centralized AI credit costs per operation.
 * Never hardcode these values inside feature routes.
 */
export const AI_CREDIT_COSTS = {
  SIMPLE_CHAT: 1,
  REPOSITORY_CHAT: 5,
  AI_REPORT: 3,
  PR_REVIEW: 5,
  REPOSITORY_OVERVIEW: 10,
  ARCHITECTURE_ANALYSIS: 20,
} as const;

export type AICreditCostKey = keyof typeof AI_CREDIT_COSTS;

export function getCreditCost(key: AICreditCostKey): number {
  return AI_CREDIT_COSTS[key];
}
