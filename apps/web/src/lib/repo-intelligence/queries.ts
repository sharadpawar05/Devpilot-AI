import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { repoIntelligenceApi } from './api';
import type { RepositoryIntelligence } from './types';

export const intelligenceKeys = {
  all: ['repo-intelligence'] as const,
  analyze: (owner: string, repo: string, branch?: string) =>
    [...intelligenceKeys.all, 'analyze', owner, repo, branch] as const,
};

export function useRepositoryIntelligence(owner: string, repo: string, branch?: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<RepositoryIntelligence | null, Error>({
    queryKey: intelligenceKeys.analyze(owner, repo, branch),
    queryFn: async () => {
      const result = await repoIntelligenceApi.analyze(owner, repo, token, branch);
      if (!result.success || !result.data)
        throw new Error(result.error?.message || 'Failed to analyze repository');
      return result.data;
    },
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useInvalidateIntelligence() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      owner,
      repo,
      branch,
    }: {
      owner: string;
      repo: string;
      branch?: string;
    }) => {
      return repoIntelligenceApi.invalidate(owner, repo, token, branch);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.analyze(variables.owner, variables.repo, variables.branch),
      });
    },
  });
}
