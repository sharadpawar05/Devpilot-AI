import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { sprintSummaryApi } from './api';
import type { SprintSummaryRequest, SprintSummaryResponse } from './types';

export function useSprintSummary() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<SprintSummaryResponse, Error, SprintSummaryRequest>({
    mutationFn: async (request) => {
      const result = await sprintSummaryApi.generateSummary(request, token);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate sprint summary');
      }
      return result;
    },
  });
}
