import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { repositoryCache } from './cache';
import { repositoryStatusService } from './status';
import { buildRepoTree, parseFileMetadata } from './parser';
import { analyzeLanguageBreakdown, analyzeStats } from './analyzer';
import type { RepoIndexData } from './types';

export class RepositoryIndexer {
  async index(
    userId: string,
    owner: string,
    repo: string,
    branch: string = 'main',
  ): Promise<RepoIndexData> {
    // Use intelligence service to get file tree and contents
    const filePaths = await repositoryIntelligenceService.getFlatFilePaths(
      userId,
      owner,
      repo,
      branch,
    );
    const fileContents = await repositoryIntelligenceService.getFileContents(
      userId,
      owner,
      repo,
      this.getKeyFilePaths(filePaths.map((p) => ({ path: p, type: 'blob' }))),
      branch,
    );

    // Build tree from flat paths
    const items = filePaths.map((p) => ({
      path: p,
      type: p.includes('/') ? 'tree' : ('blob' as string),
    }));
    const filteredItems = items.filter((item) => {
      const name = item.path.split('/').pop() || '';
      return !name.startsWith('.') || name === '.github';
    });

    const tree = buildRepoTree(items as any[]);

    const fileMetadata = filteredItems.map((item) =>
      parseFileMetadata(item, fileContents.get(item.path)),
    );

    const languageBreakdown = analyzeLanguageBreakdown(fileMetadata);
    const stats = analyzeStats(tree, fileMetadata, fileContents);

    const indexData: RepoIndexData = {
      tree,
      fileMetadata,
      languageBreakdown,
      stats,
      commitSha: branch,
      indexedAt: new Date(),
    };

    await repositoryCache.saveIndex(userId, owner, repo, branch, indexData);
    await repositoryStatusService.markReady(userId, owner, repo, branch);

    return indexData;
  }

  async getIndex(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoIndexData | null> {
    return repositoryCache.getIndexed(userId, owner, repo, branch);
  }

  async getTree(userId: string, owner: string, repo: string, branch: string) {
    const data = await repositoryCache.getIndexed(userId, owner, repo, branch);
    return data?.tree ?? [];
  }

  private getKeyFilePaths(items: Array<{ path: string; type: string }>): string[] {
    const keyPatterns = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'CONTRIBUTING.md',
      'vite.config',
      'next.config',
      'tailwind.config',
      'Dockerfile',
      'docker-compose',
    ];

    return items
      .filter((item) => {
        if (item.type === 'tree') return false;
        const name = item.path.split('/').pop() || '';
        return keyPatterns.some((p) => name.includes(p));
      })
      .slice(0, 10)
      .map((item) => item.path);
  }
}

export const repositoryIndexer = new RepositoryIndexer();
