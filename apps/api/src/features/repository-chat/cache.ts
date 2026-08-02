import { db } from '@/core/db';
import type {
  RepoIndexData,
  RepoIndexStatusEnum,
  RepoFileNode,
  RepoFileMetadata,
  RepoLanguageBreakdown,
  RepoStats,
} from './types';

function castJson<T>(value: unknown): T {
  return value as T;
}

async function resolveUserId(supabaseUserId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { supabaseUserId },
    select: { id: true },
  });
  if (!user) throw new Error('User not found');
  return user.id;
}

export class RepositoryCache {
  async getIndexed(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoIndexData | null> {
    const userId = await resolveUserId(supabaseUserId);
    const record = await db.repositoryIndex.findUnique({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
    });

    if (!record || record.status !== 'READY') return null;

    return {
      tree: castJson<RepoFileNode[]>(record.tree),
      fileMetadata: castJson<RepoFileMetadata[]>(record.fileMetadata),
      languageBreakdown: castJson<RepoLanguageBreakdown>(record.languageBreakdown),
      stats: castJson<RepoStats>(record.stats),
      commitSha: record.commitSha,
      indexedAt: record.indexedAt || new Date(),
    };
  }

  async getCommitSha(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string | null> {
    const userId = await resolveUserId(supabaseUserId);
    const record = await db.repositoryIndex.findUnique({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
      select: { commitSha: true },
    });
    return record?.commitSha ?? null;
  }

  async setStatus(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
    status: RepoIndexStatusEnum,
    errorMessage?: string,
  ): Promise<void> {
    const userId = await resolveUserId(supabaseUserId);
    await db.repositoryIndex.upsert({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
      update: {
        status,
        errorMessage: errorMessage || null,
        ...(status === 'READY' ? { indexedAt: new Date() } : {}),
      },
      create: {
        userId,
        owner,
        repo,
        branch,
        commitSha: '',
        status,
        tree: [],
        fileMetadata: [],
        languageBreakdown: {},
        stats: {},
      },
    });
  }

  async saveIndex(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
    data: RepoIndexData,
  ): Promise<void> {
    const userId = await resolveUserId(supabaseUserId);
    await db.repositoryIndex.upsert({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
      update: {
        commitSha: data.commitSha,
        status: 'READY',
        indexedAt: data.indexedAt,
        tree: data.tree as any,
        fileMetadata: data.fileMetadata as any,
        languageBreakdown: data.languageBreakdown as any,
        stats: data.stats as any,
        errorMessage: null,
      },
      create: {
        userId,
        owner,
        repo,
        branch,
        commitSha: data.commitSha,
        status: 'READY',
        indexedAt: data.indexedAt,
        tree: data.tree as any,
        fileMetadata: data.fileMetadata as any,
        languageBreakdown: data.languageBreakdown as any,
        stats: data.stats as any,
      },
    });
  }

  async getStatus(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepoIndexStatusEnum> {
    const userId = await resolveUserId(supabaseUserId);
    const record = await db.repositoryIndex.findUnique({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
      select: { status: true },
    });
    return (record?.status as RepoIndexStatusEnum) || 'NOT_INDEXED';
  }

  async isOutdated(
    supabaseUserId: string,
    owner: string,
    repo: string,
    branch: string,
    currentSha: string,
  ): Promise<boolean> {
    const userId = await resolveUserId(supabaseUserId);
    const record = await db.repositoryIndex.findUnique({
      where: {
        userId_owner_repo_branch: { userId, owner, repo, branch },
      },
      select: { commitSha: true, status: true },
    });
    if (!record || record.status !== 'READY') return false;
    return record.commitSha !== currentSha;
  }
}

export const repositoryCache = new RepositoryCache();
