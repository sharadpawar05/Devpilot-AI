export interface IncidentSummaryRequest {
  owner: string;
  repo: string;
  branch: string;
  startDate: string;
  endDate: string;
  provider?: string;
}

export interface IncidentMetrics {
  totalPullRequests: number;
  mergedPullRequests: number;
  totalCommits: number;
  totalContributors: number;
  totalIssuesOpened: number;
  totalIssuesClosed: number;
  totalAdditions: number;
  totalDeletions: number;
  totalFilesChanged: number;
}

export interface IncidentContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  pullRequests: number;
  commits: number;
  issuesOpened: number;
}

export interface IncidentFinding {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'stability' | 'code_quality' | 'operational';
}

export interface IncidentTimeline {
  date: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
}

export interface IncidentRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'immediate' | 'short_term' | 'long_term';
}

export interface IncidentSummaryData {
  executiveSummary: string;
  findings: IncidentFinding[];
  timeline: IncidentTimeline[];
  metrics: IncidentMetrics;
  contributors: IncidentContributor[];
  recommendations: IncidentRecommendation[];
  generatedAt: string;
  incidentPeriod: {
    start: string;
    end: string;
  };
}

export interface IncidentSummaryResponse {
  success: boolean;
  data?: IncidentSummaryData;
  error?: {
    code: string;
    message: string;
  };
  latencyMs?: number;
  provider?: string;
  model?: string;
}
