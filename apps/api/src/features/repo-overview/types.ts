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

export type HealthCheckCategory = 'structural' | 'quality';

export type HealthCheckStatus =
  'passed' | 'failed' | 'warning' | 'partial' | 'not_applicable' | 'not_measured';

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
  | 'generate-env-example'
  | 'improve-coverage'
  | 'improve-readme'
  | 'add-ci-pipeline'
  | 'fix-vulnerabilities'
  | 'update-dependencies';

export interface HealthQualityMetrics {
  coverage?: number;
  testCount?: number;
  testFileCount?: number;
  sectionsFound?: string[];
  sectionsMissing?: string[];
  sectionScores?: Record<string, number>;
  workflowCount?: number;
  passingWorkflows?: number;
  failingWorkflows?: number;
  vulnerabilityCount?: number;
  criticalVulnerabilities?: number;
  highVulnerabilities?: number;
  totalDependencies?: number;
  outdatedDependencies?: number;
  outdatedPercentage?: number;
  vulnerabilities?: VulnerabilityItem[];
  complexityScore?: number;
  largeFiles?: LargeFileItem[];
  debtItems?: TechDebtItem[];
  debtScore?: number;
  hotspots?: HotspotItem[];
}

export interface VulnerabilityItem {
  severity: string;
  package: string;
  description: string;
  withdrawn: boolean;
}

export interface LargeFileItem {
  path: string;
  lines: number;
  language?: string;
}

export interface TechDebtItem {
  pattern: string;
  count: number;
  files: string[];
  severity: string;
}

export interface HotspotItem {
  path: string;
  changeFrequency: number;
  sizeBytes: number;
  churnScore: number;
}

export interface RepoHealthDetail {
  id: string;
  name: string;
  category: HealthCheckCategory;
  status: HealthCheckStatus;
  passed: boolean;
  severity: HealthSeverity;
  failedDescription: string;
  whyItMatters: string;
  recommendation: string;
  estimatedEffort: string;
  actionLabel: string;
  actionType: HealthActionType;
  scorePenalty: number;
  evidence?: Record<string, unknown>;
  quality?: HealthQualityMetrics;
}

export interface ScoreBreakdownItem {
  name: string;
  penalty: number;
  category: HealthCheckCategory;
}

export interface RepositoryHealthSummary {
  structuralScore: number;
  qualityScore: number;
  structuralWeight: number;
  qualityWeight: number;
  testCoverage?: number;
  documentationScore?: number;
  cicdScore?: number;
  securityScore?: number;
  dependencyScore?: number;
  complexityScore?: number;
  debtScore?: number;
  hotspotCount?: number;
  maintainabilityScore?: number;
}

export interface RepoHealthCheck {
  score: number;
  passedCount: number;
  failedCount: number;
  warningCount?: number;
  notMeasuredCount?: number;
  criticalCount: number;
  details: RepoHealthDetail[];
  scoreBreakdown: ScoreBreakdownItem[];
  summary: RepositoryHealthSummary;
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
