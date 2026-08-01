import { useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface CodeReviewRequest {
  language: string;
  reviewType: string;
  code: string;
  context?: string;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface CodeReviewResponse {
  success: boolean;
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  usage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface CodeReviewError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function useCodeReview() {
  return useMutation<CodeReviewResponse, CodeReviewError, CodeReviewRequest>({
    mutationFn: async (request) => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/code-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      } catch {
        throw {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Unable to connect to the server. Please make sure the API is running.',
          },
        } as CodeReviewError;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw data as CodeReviewError;
      }

      return data as CodeReviewResponse;
    },
  });
}
