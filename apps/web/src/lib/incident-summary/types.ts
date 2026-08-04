export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface IncidentSummaryRequest {
  owner: string;
  repo: string;
  branch: string;
  incidentTitle: string;
  severity: IncidentSeverity;
  startDate: string;
  endDate: string;
  description?: string;
  provider?: string;
}

export interface IncidentTimelineEvent {
  timestamp: string;
  event: string;
  actor?: string;
  type: 'detection' | 'investigation' | 'fix' | 'resolution' | 'communication' | 'other';
}

export interface IncidentPR {
  number: number;
  title: string;
  author: string;
  state: string;
  url: string;
  mergedAt?: string;
  relatedToIncident: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface IncidentCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  relatedToIncident: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface IncidentContributor {
  login: string;
  avatar_url: string;
  role: 'fixer' | 'reviewer' | 'reporter' | 'affected';
  contributions: number;
}

export interface ImpactAssessment {
  affectedUsers: string;
  affectedServices: string[];
  duration: string;
  severity: IncidentSeverity;
  businessImpact: string;
}

export interface RootCause {
  summary: string;
  isConfirmed: boolean;
  confidence: 'high' | 'medium' | 'low';
  contributingFactors: string[];
}

export interface ActionItem {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'immediate' | 'short-term' | 'long-term';
  assignee?: string;
}

export interface PreventiveRecommendation {
  title: string;
  description: string;
  category: 'monitoring' | 'process' | 'architecture' | 'testing';
  priority: 'high' | 'medium' | 'low';
}

export interface IncidentSummaryData {
  incidentDetails: {
    title: string;
    severity: IncidentSeverity;
    startDate: string;
    endDate: string;
    duration: string;
    status: 'resolved' | 'ongoing' | 'monitoring';
  };
  executiveSummary: string;
  timeline: IncidentTimelineEvent[];
  impactAssessment: ImpactAssessment;
  rootCause: RootCause;
  relatedPullRequests: IncidentPR[];
  relatedCommits: IncidentCommit[];
  contributors: IncidentContributor[];
  resolutionSummary: string;
  actionItems: ActionItem[];
  preventiveRecommendations: PreventiveRecommendation[];
  generatedAt: string;
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
