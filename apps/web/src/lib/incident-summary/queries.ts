import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { incidentSummaryApi, IncidentSummaryApiError } from './api';
import type { IncidentSummaryRequest, IncidentSummaryResponse } from './types';

export function useIncidentSummary() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<IncidentSummaryResponse, Error, IncidentSummaryRequest>({
    mutationFn: async (request) => {
      try {
        const result = await incidentSummaryApi.generateSummary(request, token);
        if (!result.success) {
          throw new IncidentSummaryApiError(
            result.error?.message || 'Failed to generate incident summary',
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
        if (error instanceof IncidentSummaryApiError) throw error;
        throw new IncidentSummaryApiError(
          error instanceof Error ? error.message : 'Failed to generate incident summary',
        );
      }
    },
  });
}
