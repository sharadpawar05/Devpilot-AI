import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { repoOverviewApi } from './api';
import type { RepoOverviewData, RepoFileNode, RepoContributor } from './types';

export const repoOverviewKeys = {
  all: ['repo-overview'] as const,
  overview: (owner: string, repo: string) =>
    [...repoOverviewKeys.all, 'overview', owner, repo] as const,
  tree: (owner: string, repo: string) => [...repoOverviewKeys.all, 'tree', owner, repo] as const,
  contributors: (owner: string, repo: string) =>
    [...repoOverviewKeys.all, 'contributors', owner, repo] as const,
};

export function useRepoOverview(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepoOverviewData | null, Error>({
    queryKey: repoOverviewKeys.overview(owner, repo),
    queryFn: async () => {
      const result = await repoOverviewApi.getOverview(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch overview');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRepoTree(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepoFileNode[], Error>({
    queryKey: repoOverviewKeys.tree(owner, repo),
    queryFn: async () => {
      const result = await repoOverviewApi.getTree(owner, repo, token);
      if (!result.success || !result.tree) throw new Error(result.error || 'Failed to fetch tree');
      return result.tree;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRepoContributors(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepoContributor[], Error>({
    queryKey: repoOverviewKeys.contributors(owner, repo),
    queryFn: async () => {
      const result = await repoOverviewApi.getContributors(owner, repo, token);
      if (!result.success || !result.contributors)
        throw new Error(result.error || 'Failed to fetch contributors');
      return result.contributors;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
