export type ProjectType =
  'web-app' | 'api' | 'library' | 'cli' | 'mobile' | 'monorepo' | 'static-site' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

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

export interface IntelligenceApiResult {
  success: boolean;
  data?: RepositoryIntelligence;
  error?: { message: string };
}
