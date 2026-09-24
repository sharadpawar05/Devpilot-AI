import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { engineeringStatusApi, EngineeringStatusApiError } from './api';
import type { EngineeringStatusRequest, EngineeringStatusResponse } from './types';

export function useEngineeringStatus() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<EngineeringStatusResponse, Error, EngineeringStatusRequest>({
    mutationFn: async (request) => {
      try {
        const result = await engineeringStatusApi.generateReport(request, token);
        if (!result.success) {
          throw new EngineeringStatusApiError(
            result.error?.message || 'Failed to generate engineering status report',
            result.error?.code,
            result.error?.retryable,
          );
        }
        return result;
      } catch (error) {
        if (error instanceof EngineeringStatusApiError) {
          throw error;
        }
        throw new EngineeringStatusApiError(
          error instanceof Error ? error.message : 'Failed to generate engineering status report',
        );
      }
    },
  });
}
