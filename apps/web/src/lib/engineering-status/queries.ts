import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/auth';
import { engineeringStatusApi } from './api';
import type { EngineeringStatusRequest, EngineeringStatusResponse } from './types';

export function useEngineeringStatus() {
  const { session } = useAuth();
  const token = session?.accessToken;

  return useMutation<EngineeringStatusResponse, Error, EngineeringStatusRequest>({
    mutationFn: async (request) => {
      const result = await engineeringStatusApi.generateReport(request, token);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate engineering status report');
      }
      return result;
    },
  });
}
