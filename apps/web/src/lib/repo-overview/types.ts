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
  html_url: string;
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
  workflowTypes?: string[];
  vulnerabilityCount?: number;
  criticalVulnerabilities?: number;
  highVulnerabilities?: number;
  dependabotAccessible?: boolean;
  totalDependencies?: number;
  outdatedDependencies?: number;
  outdatedPercentage?: number;
  hasLockfile?: boolean;
  majorOutdated?: number;
  minorOutdated?: number;
  patchOutdated?: number;
  // Vulnerability details
  vulnerabilities?: VulnerabilityItem[];
  // Complexity metrics
  complexityScore?: number;
  largeFiles?: LargeFileItem[];
  // Technical debt
  debtItems?: TechDebtItem[];
  debtScore?: number;
  // Hotspots
  hotspots?: HotspotItem[];
}

export interface VulnerabilityItem {
  severity: 'critical' | 'high' | 'medium' | 'low';
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
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface HotspotItem {
  path: string;
  score: number;
  commits: number;
  lines: number;
  reason: string;
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
  documentationScore?: number | null;
  cicdScore?: number | null;
  securityScore?: number | null;
  dependencyScore?: number | null;
  complexityScore?: number | null;
  debtScore?: number;
  hotspotCount?: number;
  maintainabilityScore?: number;
}

export interface HealthMetricTrend {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
}

export interface HealthTrend {
  score: HealthMetricTrend;
  coverage: HealthMetricTrend | null;
  previousAt: string;
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
  updatedAt?: string;
  trend?: HealthTrend | null;
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

export type RepoOverviewState = 'idle' | 'loading' | 'ready' | 'error' | 'generating-summary';

export interface RepoOverviewError {
  message: string;
  code?: string;
}
