export type TimeRange = '7d' | '14d' | '30d' | 'custom';

export interface EngineeringStatusRequest {
  owner: string;
  repo: string;
  branch: string;
  timeRange: TimeRange;
  startDate?: string;
  endDate?: string;
  provider?: string;
}

export interface EngineeringMetrics {
  prsCreated: number;
  prsMerged: number;
  prsOpen: number;
  prsClosed: number;
  commits: number;
  contributors: number;
  reviewTime: number;
  avgPrSize: number;
  openIssues: number;
  closedIssues: number;
  codeChurn: number;
  additions: number;
  deletions: number;
}

export interface TeamHighlight {
  title: string;
  description: string;
  impact: 'positive' | 'neutral' | 'negative';
}

export interface EngineeringRisk {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface EngineeringBlocker {
  title: string;
  description: string;
  status: 'active' | 'resolved';
  affectedPrs?: number;
}

export interface EngineeringContributor {
  login: string;
  avatar_url: string;
  commits: number;
  prsCreated: number;
  prsReviewed: number;
  issuesClosed: number;
  linesAdded: number;
  linesDeleted: number;
}

export interface TeamTrend {
  metric: string;
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface EngineeringRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'process' | 'technical' | 'team' | 'quality';
}

export interface EngineeringStatusData {
  executiveSummary: string;
  teamHighlights: TeamHighlight[];
  engineeringMetrics: EngineeringMetrics;
  risks: EngineeringRisk[];
  blockers: EngineeringBlocker[];
  contributors: EngineeringContributor[];
  trends: TeamTrend[];
  recommendations: EngineeringRecommendation[];
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
    label: string;
  };
}

export interface EngineeringStatusResponse {
  success: boolean;
  data?: EngineeringStatusData;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
    feature?: string;
    used?: number;
    limit?: number;
    resetAt?: string;
  };
  latencyMs?: number;
  provider?: string;
  model?: string;
}
