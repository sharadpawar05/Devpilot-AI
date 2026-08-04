import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { repositoryIntelligenceApi } from './api';
import type {
  RepositoryOverview,
  RepositoryMetadata,
  RepositoryStatistics,
  RepositoryHealth,
  Contributor,
  PullRequest,
  PullRequestFile,
  Commit,
  Release,
  Issue,
  ActivityEvent,
  CommitActivity,
  FileTreeNode,
  RepositoryIntelligence,
} from './types';

// ─── Query Key Factories ─────────────────────────────────────────────────────

export const intelligenceKeys = {
  all: ['repo-intelligence'] as const,
  overview: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'overview', owner, repo] as const,
  metadata: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'metadata', owner, repo] as const,
  statistics: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'statistics', owner, repo] as const,
  contributors: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'contributors', owner, repo] as const,
  pullRequests: (owner: string, repo: string, state?: string) =>
    [...intelligenceKeys.all, 'pull-requests', owner, repo, state] as const,
  pullRequestFiles: (owner: string, repo: string, pullNumber: number) =>
    [...intelligenceKeys.all, 'pr-files', owner, repo, pullNumber] as const,
  commits: (owner: string, repo: string, branch?: string) =>
    [...intelligenceKeys.all, 'commits', owner, repo, branch] as const,
  releases: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'releases', owner, repo] as const,
  issues: (owner: string, repo: string, state?: string) =>
    [...intelligenceKeys.all, 'issues', owner, repo, state] as const,
  activity: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'activity', owner, repo] as const,
  commitActivity: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'commit-activity', owner, repo] as const,
  fileTree: (owner: string, repo: string, branch?: string) =>
    [...intelligenceKeys.all, 'file-tree', owner, repo, branch] as const,
  health: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'health', owner, repo] as const,
  analyze: (owner: string, repo: string, branch?: string) =>
    [...intelligenceKeys.all, 'analyze', owner, repo, branch] as const,
  readme: (owner: string, repo: string) =>
    [...intelligenceKeys.all, 'readme', owner, repo] as const,
};

// ─── Overview Hook ───────────────────────────────────────────────────────────

export function useRepositoryOverview(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryOverview | null, Error>({
    queryKey: intelligenceKeys.overview(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getOverview(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch overview');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Metadata Hook ───────────────────────────────────────────────────────────

export function useRepositoryMetadata(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryMetadata | null, Error>({
    queryKey: intelligenceKeys.metadata(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getMetadata(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch metadata');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Statistics Hook ─────────────────────────────────────────────────────────

export function useRepositoryStatistics(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryStatistics | null, Error>({
    queryKey: intelligenceKeys.statistics(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getStatistics(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch statistics');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Contributors Hook ───────────────────────────────────────────────────────

export function useRepositoryContributors(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<Contributor[], Error>({
    queryKey: intelligenceKeys.contributors(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getContributors(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch contributors');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Pull Requests Hook ──────────────────────────────────────────────────────

export function useRepositoryPullRequests(owner: string, repo: string, state: string = 'open') {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<PullRequest[], Error>({
    queryKey: intelligenceKeys.pullRequests(owner, repo, state),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getPullRequests(owner, repo, token, state);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch pull requests');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Pull Request Files Hook ─────────────────────────────────────────────────

export function useRepositoryPullRequestFiles(owner: string, repo: string, pullNumber: number) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<PullRequestFile[], Error>({
    queryKey: intelligenceKeys.pullRequestFiles(owner, repo, pullNumber),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getPullRequestFiles(
        owner,
        repo,
        pullNumber,
        token,
      );
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch PR files');
      return result.data;
    },
    enabled: !!owner && !!repo && !!pullNumber && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Commits Hook ────────────────────────────────────────────────────────────

export function useRepositoryCommits(owner: string, repo: string, branch?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<Commit[], Error>({
    queryKey: intelligenceKeys.commits(owner, repo, branch),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getCommits(owner, repo, token, branch);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch commits');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Releases Hook ───────────────────────────────────────────────────────────

export function useRepositoryReleases(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<Release[], Error>({
    queryKey: intelligenceKeys.releases(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getReleases(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch releases');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Issues Hook ─────────────────────────────────────────────────────────────

export function useRepositoryIssues(owner: string, repo: string, state: string = 'open') {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<Issue[], Error>({
    queryKey: intelligenceKeys.issues(owner, repo, state),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getIssues(owner, repo, token, state);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch issues');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Activity Hook ───────────────────────────────────────────────────────────

export function useRepositoryActivity(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<ActivityEvent[], Error>({
    queryKey: intelligenceKeys.activity(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getActivity(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch activity');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

// ─── Commit Activity Hook ────────────────────────────────────────────────────

export function useRepositoryCommitActivity(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<CommitActivity[], Error>({
    queryKey: intelligenceKeys.commitActivity(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getCommitActivity(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch commit activity');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── File Tree Hook ──────────────────────────────────────────────────────────

export function useRepositoryFileTree(owner: string, repo: string, branch?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<FileTreeNode[], Error>({
    queryKey: intelligenceKeys.fileTree(owner, repo, branch),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getFileTree(owner, repo, token, branch);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch file tree');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}

// ─── Health Hook ─────────────────────────────────────────────────────────────

export function useRepositoryHealth(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryHealth | null, Error>({
    queryKey: intelligenceKeys.health(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getHealth(owner, repo, token);
      if (!result.success || !result.data)
        throw new Error(result.error || 'Failed to fetch health');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Technology Analysis Hook ────────────────────────────────────────────────

export function useRepositoryIntelligence(owner: string, repo: string, branch?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryIntelligence | null, Error>({
    queryKey: intelligenceKeys.analyze(owner, repo, branch),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.analyze(owner, repo, token, branch);
      if (!result.success || !result.data)
        throw new Error(result.error?.message || 'Failed to analyze repository');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

// ─── Readme Hook ─────────────────────────────────────────────────────────────

export function useRepositoryReadme(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<string, Error>({
    queryKey: intelligenceKeys.readme(owner, repo),
    queryFn: async () => {
      const result = await repositoryIntelligenceApi.getReadme(owner, repo, token);
      if (!result.success || result.content === undefined)
        throw new Error(result.error || 'Failed to fetch readme');
      return result.content;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// ─── Invalidate Cache Mutation ───────────────────────────────────────────────

export function useInvalidateIntelligence() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ owner, repo }: { owner: string; repo: string }) => {
      return repositoryIntelligenceApi.invalidate(owner, repo, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.all,
      });
    },
  });
}
