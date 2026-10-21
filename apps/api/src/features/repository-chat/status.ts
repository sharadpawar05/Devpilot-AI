import { repositoryCache } from './cache';
import type { RepoIndexStatusEnum } from './types';

export class RepositoryStatusService {
  async getStatus(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoIndexStatusEnum> {
    return repositoryCache.getStatus(userId, owner, repo, branch);
  }

  async setStatus(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    status: RepoIndexStatusEnum,
    errorMessage?: string,
  ): Promise<void> {
    await repositoryCache.setStatus(userId, owner, repo, branch, status, errorMessage);
  }

  async markIndexing(userId: string, owner: string, repo: string, branch: string): Promise<void> {
    await this.setStatus(userId, owner, repo, branch, 'INDEXING');
  }

  /**
   * Atomically claim the indexing job. Returns false when another request
   * already holds a fresh claim (or a valid claim exists) — callers must
   * respond 409 instead of starting a duplicate job.
   */
  async claimIndexing(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    staleMs?: number,
  ): Promise<boolean> {
    return repositoryCache.claimIndexing(userId, owner, repo, branch, staleMs);
  }

  async markReady(userId: string, owner: string, repo: string, branch: string): Promise<void> {
    await this.setStatus(userId, owner, repo, branch, 'READY');
  }

  async markFailed(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    error: string,
  ): Promise<void> {
    await this.setStatus(userId, owner, repo, branch, 'FAILED', error);
  }

  async markOutdated(userId: string, owner: string, repo: string, branch: string): Promise<void> {
    await this.setStatus(userId, owner, repo, branch, 'OUTDATED');
  }

  async shouldReindex(
    userId: string,
    owner: string,
    repo: string,
    branch: string,
    currentSha: string,
  ): Promise<boolean> {
    const status = await this.getStatus(userId, owner, repo, branch);
    if (status === 'NOT_INDEXED' || status === 'FAILED' || status === 'OUTDATED') return true;
    if (status === 'INDEXING') return false;
    return repositoryCache.isOutdated(userId, owner, repo, branch, currentSha);
  }
}

export const repositoryStatusService = new RepositoryStatusService();
