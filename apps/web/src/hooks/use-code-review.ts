import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AIProviderName, AIModel } from '@devpilot/types';
import { aiHistoryStorage } from '@/lib/ai-history';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface CodeReviewRequest {
  language: string;
  reviewType: string;
  reviewDepth: string;
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
  reviewDepth: string;
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateCodeReviewTitle(language: string, reviewType: string): string {
  return `${language} ${reviewType} Review`;
}

export function useCodeReview() {
  const saveToHistory = useCallback(
    async (params: {
      language: string;
      reviewType: string;
      reviewDepth: string;
      code: string;
      provider: string;
      model: string;
      response: string;
      latencyMs: number;
      tokens: number;
    }) => {
      const userMessage = `Review ${params.language} code (${params.reviewType}, ${params.reviewDepth}):\n\n${params.code}`;

      return aiHistoryStorage.createSession({
        workflowType: 'code-review',
        title: generateCodeReviewTitle(params.language, params.reviewType),
        provider: (params.provider || 'gemini') as AIProviderName,
        model: (params.model || 'gemini-2.0-flash') as AIModel,
        messages: [
          {
            id: generateId(),
            role: 'user',
            content: userMessage,
            latency: 0,
            tokens: 0,
            timestamp: new Date().toISOString(),
          },
          {
            id: generateId(),
            role: 'assistant',
            content: params.response,
            latency: params.latencyMs,
            tokens: params.tokens,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    },
    [],
  );

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

      const response = data as CodeReviewResponse;

      await saveToHistory({
        language: request.language,
        reviewType: request.reviewType,
        reviewDepth: request.reviewDepth,
        code: request.code,
        provider: response.provider,
        model: response.model,
        response: response.response,
        latencyMs: response.latencyMs,
        tokens: response.usage.total,
      });

      return response;
    },
  });
}
