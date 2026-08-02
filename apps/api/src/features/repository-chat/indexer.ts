import { getOctokit } from '@/core/github';
import { repositoryCache } from './cache';
import { repositoryStatusService } from './status';
import { buildRepoTree, filterSupportedFiles, parseFileMetadata } from './parser';
import { analyzeLanguageBreakdown, analyzeStats } from './analyzer';
import type { RepoIndexData } from './types';

const MAX_FILE_CONTENT_FETCH = 50;
const MAX_FILE_CONTENT_SIZE = 50_000;

export class RepositoryIndexer {
  async index(
    userId: string,
    owner: string,
    repo: string,
    branch: string = 'main',
  ): Promise<RepoIndexData> {
    const octokit = await getOctokit(userId);

    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const commitSha = refData.object.sha;

    const shouldSkip = !(await repositoryStatusService.shouldReindex(
      userId,
      owner,
      repo,
      branch,
      commitSha,
    ));
    if (shouldSkip) {
      const cached = await repositoryCache.getIndexed(userId, owner, repo, branch);
      if (cached) return cached;
    }

    try {
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: 'true',
      });

      const filteredItems = filterSupportedFiles(treeData.tree as any[]);
      const tree = buildRepoTree(treeData.tree as any[]);

      const keyFiles = this.getKeyFilePaths(filteredItems);
      const fileContents = await this.fetchFileContents(octokit, owner, repo, keyFiles);

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
        commitSha: treeData.sha,
        indexedAt: new Date(),
      };

      await repositoryCache.saveIndex(userId, owner, repo, branch, indexData);
      await repositoryStatusService.markReady(userId, owner, repo, branch);

      return indexData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await repositoryStatusService.markFailed(userId, owner, repo, branch, message);
      throw error;
    }
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

  private async fetchFileContents(
    octokit: any,
    owner: string,
    repo: string,
    paths: string[],
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>();

    const fetches = paths.slice(0, MAX_FILE_CONTENT_FETCH).map(async (path) => {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
        if ('content' in data && typeof data.content === 'string') {
          const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
          if (decoded.length <= MAX_FILE_CONTENT_SIZE) {
            contents.set(path, decoded);
          }
        }
      } catch {
        // Skip files that can't be fetched
      }
    });

    await Promise.allSettled(fetches);
    return contents;
  }
}

export const repositoryIndexer = new RepositoryIndexer();
