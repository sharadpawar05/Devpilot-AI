import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export interface ChatRequest {
  provider: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
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

export interface ChatError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function useChat() {
  return useMutation<ChatResponse, ChatError, ChatRequest>({
    mutationFn: async (request) => {
      const result = await apiClient.post<ChatResponse>('/ai/chat', request);

      if (!result.success) {
        throw result as ChatError;
      }

      return result.data as ChatResponse;
    },
  });
}
