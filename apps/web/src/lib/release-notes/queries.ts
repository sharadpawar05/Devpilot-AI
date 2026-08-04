import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { releaseNotesApi } from './api';
import type { ReleaseNotesRequest, ReleaseNotesResponse, ReleaseTag } from './types';

export function useReleaseNotes() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<ReleaseNotesResponse, Error, ReleaseNotesRequest>({
    mutationFn: async (request) => {
      const result = await releaseNotesApi.generateReleaseNotes(request, token);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate release notes');
      }
      return result;
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
