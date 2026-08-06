// ─── Project Classification ──────────────────────────────────────────────────

export type ProjectType =
  'web-app' | 'api' | 'library' | 'cli' | 'mobile' | 'monorepo' | 'static-site' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

// ─── Technology Detection ────────────────────────────────────────────────────

export interface DetectedTechnology {
  name: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
}

export interface ImportantFile {
  path: string;
  purpose: string;
  exists: boolean;
}

export interface FolderNode {
  name: string;
  type: 'file' | 'directory';
  children?: FolderNode[];
}

// ─── Repository Metadata ─────────────────────────────────────────────────────

export interface RepositoryOwner {
  login: string;
  avatar_url: string;
  id?: number;
}

export interface RepositoryLicense {
  spdx_id: string;
  name: string;
}

export interface RepositoryMetadata {
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
  license: RepositoryLicense | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: RepositoryOwner;
}

// ─── Repository Statistics ───────────────────────────────────────────────────

export interface RepositoryStatistics {
  totalFiles: number;
  totalDirectories: number;
  totalBranches: number;
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  totalReleases: number;
  totalContributors: number;
  languageBreakdown: Record<string, number>;
}

// ─── File Tree ───────────────────────────────────────────────────────────────

export interface FileTreeNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileTreeNode[];
}

// ─── Contributors ────────────────────────────────────────────────────────────

export interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

// ─── Branches ────────────────────────────────────────────────────────────────

export interface Branch {
  name: string;
  is_default: boolean;
  commit_sha?: string;
}

// ─── Pull Requests ───────────────────────────────────────────────────────────

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
  base_branch?: string;
  head_branch?: string;
  merged?: boolean;
}

export interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

// ─── Commits ─────────────────────────────────────────────────────────────────

export interface Commit {
  sha: string;
  message: string;
  author: string | null;
  author_date: string;
  html_url: string;
  additions?: number;
  deletions?: number;
}

// ─── Releases ────────────────────────────────────────────────────────────────

export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: string | null;
  html_url: string;
}

// ─── Issues ──────────────────────────────────────────────────────────────────

export interface Issue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  user: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  labels: string[];
  assignees: string[];
}

// ─── Recent Activity ─────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  type: string;
  actor: string;
  created_at: string;
  repo: string;
  payload: Record<string, unknown>;
}

// ─── Commit Activity ─────────────────────────────────────────────────────────

export interface CommitActivity {
  week: string;
  total: number;
  days: number[];
}

// ─── Repository Health ───────────────────────────────────────────────────────

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low';

export type HealthCheckCategory = 'structural' | 'quality';

export type HealthCheckStatus = 'passed' | 'failed' | 'warning' | 'partial';

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

export interface HealthCheckDetail {
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
  quality?: HealthQualityMetrics;
}

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
}

export interface ScoreBreakdownItem {
  name: string;
  penalty: number;
  category: HealthCheckCategory;
}

export interface RepositoryHealth {
  score: number;
  passedCount: number;
  failedCount: number;
  criticalCount: number;
  details: HealthCheckDetail[];
  scoreBreakdown: ScoreBreakdownItem[];
  summary: RepositoryHealthSummary;
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
}

// ─── Repository Intelligence (Technology Analysis) ───────────────────────────

export interface RepositoryIntelligence {
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  projectType: ProjectType;
  detectedLanguages: DetectedTechnology[];
  detectedFrameworks: DetectedTechnology[];
  detectedDatabases: DetectedTechnology[];
  detectedORMs: DetectedTechnology[];
  detectedTesting: DetectedTechnology[];
  detectedStyling: DetectedTechnology[];
  detectedStateManagement: DetectedTechnology[];
  packageManager: PackageManager;
  buildTools: DetectedTechnology[];
  lintingTools: DetectedTechnology[];
  formattingTools: DetectedTechnology[];
  importantFiles: ImportantFile[];
  folderTreeSummary: FolderNode[];
  repositorySummary: string;
  generatedAt: string;
}

// ─── File Content ────────────────────────────────────────────────────────────

export interface FileContent {
  name: string;
  path: string;
  content: string;
  size: number;
}

// ─── Aggregated Overview ─────────────────────────────────────────────────────

export interface RepositoryOverview {
  metadata: RepositoryMetadata;
  statistics: RepositoryStatistics;
  health: RepositoryHealth;
  languages: Record<string, number>;
  contributors: Contributor[];
  tree: FileTreeNode[];
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; code?: string };
}

export interface IntelligenceRequest {
  owner: string;
  repo: string;
  branch?: string;
}

export interface IntelligenceResponse {
  success: boolean;
  data?: RepositoryIntelligence;
  error?: { message: string };
}
