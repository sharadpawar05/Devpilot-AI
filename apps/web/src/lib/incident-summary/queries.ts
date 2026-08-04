import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { incidentSummaryApi } from './api';
import type { IncidentSummaryRequest, IncidentSummaryResponse } from './types';

export function useIncidentSummaryMutation() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<IncidentSummaryResponse, Error, IncidentSummaryRequest>({
    mutationFn: async (request) => {
      const result = await incidentSummaryApi.generateReport(request, token);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate incident summary');
      }
      return result;
    },
  });
}
