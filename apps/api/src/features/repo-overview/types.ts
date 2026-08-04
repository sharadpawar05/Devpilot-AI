export interface RepoOverviewMetadata {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  visibility: 'public' | 'private';
  size: number;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  license: { spdx_id: string; name: string } | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface RepoFileNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  children?: RepoFileNode[];
}

export interface RepoLanguageBreakdown {
  [language: string]: number;
}

export interface RepoContributor {
  login: string;
  avatar_url: string;
  contributions: number;
}

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low';

export type HealthActionType =
  | 'none'
  | 'generate-readme'
  | 'generate-license'
  | 'generate-gitignore'
  | 'generate-package-json'
  | 'generate-ci'
  | 'generate-tests'
  | 'generate-docs'
  | 'generate-dockerfile'
  | 'generate-env-example';

export interface RepoHealthDetail {
  name: string;
  passed: boolean;
  severity: HealthSeverity;
  failedDescription: string;
  whyItMatters: string;
  recommendation: string;
  estimatedEffort: string;
  actionLabel: string;
  actionType: HealthActionType;
  scorePenalty: number;
}

export interface ScoreBreakdownItem {
  name: string;
  penalty: number;
}

export interface RepoHealthCheck {
  score: number;
  passedCount: number;
  failedCount: number;
  criticalCount: number;
  details: RepoHealthDetail[];
  scoreBreakdown: ScoreBreakdownItem[];
}

export interface RepoOverviewData {
  metadata: RepoOverviewMetadata;
  tree: RepoFileNode[];
  languages: RepoLanguageBreakdown;
  contributors: RepoContributor[];
  health: RepoHealthCheck;
  totalFiles: number;
  totalDirectories: number;
}

export interface RepoSummaryRequest {
  owner: string;
  repo: string;
}

export interface RepoSummaryResponse {
  summary: string;
}
