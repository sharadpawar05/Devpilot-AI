export type DateRange = 'today' | '7days' | '30days' | 'month' | 'custom';
export type ChartType = 'area' | 'bar' | 'pie';

export interface AnalyticsOverview {
  aiRequestsToday: number;
  totalAIRequests: number;
  reposConnected: number;
  prReviews: number;
  codeReviews: number;
  repositoryChats: number;
  playgroundSessions: number;
  tokensUsed: number;
  estimatedTimeSaved: number;
  avgResponseTime: number;
  successRate: number;
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
}

export interface FeatureUsage {
  feature: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ProviderUsage {
  provider: string;
  requests: number;
  avgResponseTime: number;
  avgTokens: number;
  successRate: number;
  costEstimate: number;
}

export interface ModelUsage {
  model: string;
  count: number;
  percentage: number;
}

export interface ReviewTypeUsage {
  type: string;
  count: number;
  percentage: number;
}

export interface RepositoryInsight {
  name: string;
  healthScore: number | null;
  prReviews: number;
  repoChats: number;
  codeReviews: number;
  lastActivity: string | null;
  topSuggestions: string[];
}

export interface ProductivityMetrics {
  hoursSaved: number;
  codeLinesReviewed: number;
  prsImproved: number;
  bugsPrevented: number;
  documentationGenerated: number;
  commitMessagesGenerated: number;
}

export interface ActivityTimelineItem {
  id: string;
  type: 'repo-chat' | 'pr-review' | 'code-review' | 'playground' | 'repo-analysis';
  title: string;
  repository?: string;
  timestamp: string;
  model?: string;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  dailyUsage: DailyUsage[];
  featureUsage: FeatureUsage[];
  providerUsage: ProviderUsage[];
  modelUsage: ModelUsage[];
  reviewTypeUsage: ReviewTypeUsage[];
  repositoryInsights: RepositoryInsight[];
  productivity: ProductivityMetrics;
  recentActivity: ActivityTimelineItem[];
}
