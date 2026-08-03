export interface RepoFileNode {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: RepoFileNode[];
  sha?: string;
  size?: number;
}

export interface RepoFileMetadata {
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  sha: string;
  imports: string[];
  exports: string[];
  lineCount?: number;
}

export interface RepoLanguageBreakdown {
  [language: string]: {
    files: number;
    totalSize: number;
  };
}

export interface RepoStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  componentCount: number;
  apiRouteCount: number;
  hookCount: number;
  configFiles: string[];
  keyFiles: string[];
}

export interface RepoIndexData {
  tree: RepoFileNode[];
  fileMetadata: RepoFileMetadata[];
  languageBreakdown: RepoLanguageBreakdown;
  stats: RepoStats;
  commitSha: string;
  indexedAt: Date;
}

export interface RepoIndexStatus {
  status: 'NOT_INDEXED' | 'INDEXING' | 'READY' | 'FAILED' | 'OUTDATED';
  commitSha?: string;
  indexedAt?: Date;
  errorMessage?: string;
}

export type RepoIndexStatusEnum = 'NOT_INDEXED' | 'INDEXING' | 'READY' | 'FAILED' | 'OUTDATED';
