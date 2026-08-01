import { useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/ai/chat`, {
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
        } as ChatError;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw data as ChatError;
      }

      return data as ChatResponse;
    },
  });
}
