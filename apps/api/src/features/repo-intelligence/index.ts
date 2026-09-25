export { repoIntelligenceRoutes } from './routes';
export { repositoryIntelligenceService } from './repository-service';
export { intelligenceService } from './intelligence-service';
export type { HealthTrend, HealthMetricTrend, HealthSnapshotPoint } from './health-trend';
export type {
  RepositoryIntelligence,
  IntelligenceRequest,
  IntelligenceResponse,
  DetectedTechnology,
  ImportantFile,
  FolderNode,
  ProjectType,
  PackageManager,
  RepositoryMetadata,
  RepositoryStatistics,
  RepositoryHealth,
  Contributor,
  Branch,
  PullRequest,
  PullRequestFile,
  Commit,
  Release,
  Issue,
  ActivityEvent,
  CommitActivity,
  FileTreeNode,
  FileContent,
  HealthCheckDetail,
  HealthSeverity,
  HealthActionType,
  ScoreBreakdownItem,
  ApiResponse,
} from './types';
