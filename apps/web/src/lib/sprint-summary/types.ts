export interface SprintSummaryRequest {
  owner: string;
  repo: string;
  branch: string;
  startDate: string;
  endDate: string;
  provider?: string;
}

export interface SprintMetrics {
  totalPullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  totalCommits: number;
  totalContributors: number;
  totalIssuesOpened: number;
  totalIssuesClosed: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
  averagePrSize: number;
  mergeRate: number;
}

export interface SprintContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  pullRequests: number;
  commits: number;
  issuesOpened: number;
  issuesClosed: number;
}

export interface SprintHighlight {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SprintRisk {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface SprintRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'process' | 'technical' | 'team' | 'security';
}

export interface SprintSummaryData {
  executiveSummary: string;
  highlights: SprintHighlight[];
  risks: SprintRisk[];
  metrics: SprintMetrics;
  contributors: SprintContributor[];
  recommendations: SprintRecommendation[];
  generatedAt: string;
  sprintPeriod: {
    start: string;
    end: string;
  };
}

export interface SprintSummaryResponse {
  success: boolean;
  data?: SprintSummaryData;
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
