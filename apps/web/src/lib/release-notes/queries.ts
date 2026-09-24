import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { releaseNotesApi, ReleaseNotesApiError } from './api';
import type { ReleaseNotesRequest, ReleaseNotesResponse, ReleaseTag } from './types';

export function useReleaseNotes() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<ReleaseNotesResponse, Error, ReleaseNotesRequest>({
    mutationFn: async (request) => {
      try {
        const result = await releaseNotesApi.generateReleaseNotes(request, token);
        if (!result.success) {
          throw new ReleaseNotesApiError(
            result.error?.message || 'Failed to generate release notes',
            {
              code: result.error?.code,
              feature: result.error?.feature,
              used: result.error?.used,
              limit: result.error?.limit,
              resetAt: result.error?.resetAt,
              retryable: false,
            },
          );
        }
        return result;
      } catch (error) {
        if (error instanceof ReleaseNotesApiError) throw error;
        throw new ReleaseNotesApiError(
          error instanceof Error ? error.message : 'Failed to generate release notes',
        );
      }
    },
  });
}

export function useReleaseTags(owner: string, repo: string) {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useQuery<{ success: boolean; tags: ReleaseTag[] }, Error>({
    queryKey: ['release-tags', owner, repo],
    queryFn: () => releaseNotesApi.getReleaseTags(owner, repo, token),
    enabled: !!owner && !!repo && !!token,
    staleTime: 5 * 60 * 1000,
  });
}
