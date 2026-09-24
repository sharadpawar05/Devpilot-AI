import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { sprintSummaryApi, SprintSummaryApiError } from './api';
import type { SprintSummaryRequest, SprintSummaryResponse } from './types';

export function useSprintSummary() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<SprintSummaryResponse, Error, SprintSummaryRequest>({
    mutationFn: async (request) => {
      try {
        const result = await sprintSummaryApi.generateSummary(request, token);
        if (!result.success) {
          throw new SprintSummaryApiError(
            result.error?.message || 'Failed to generate sprint summary',
            result.error?.code,
            result.error?.retryable,
            {
              feature: result.error?.feature,
              used: result.error?.used,
              limit: result.error?.limit,
              resetAt: result.error?.resetAt,
            },
          );
        }
        return result;
      } catch (error) {
        if (error instanceof SprintSummaryApiError) {
          throw error;
        }
        throw new SprintSummaryApiError(
          error instanceof Error ? error.message : 'Failed to generate sprint summary',
        );
      }
    },
  });
}
