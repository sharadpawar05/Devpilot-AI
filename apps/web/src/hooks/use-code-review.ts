import { useCallback } from 'react';
import { useAuth } from '@/auth';
import type { AIProviderName, AIModel } from '@devpilot/types';
import { aiHistoryApi } from '@/lib/ai-history';
import { useStreamSession } from './use-stream';

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
  stream?: boolean;
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
  const { session } = useAuth();
  const token = session?.accessToken;
  const stream = useStreamSession();

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
      if (!token) return;
      const userMessage = `Review ${params.language} code (${params.reviewType}, ${params.reviewDepth}):\n\n${params.code}`;

      await aiHistoryApi.createSession(token, {
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
    [token],
  );

  const mutateAsync = useCallback(
    async (request: CodeReviewRequest) => {
      if (request.stream) {
        return new Promise<CodeReviewResponse>((resolve, reject) => {
          stream.startStream({
            workflowType: 'CODE_REVIEW',
            provider: request.provider || 'gemini',
            model: request.model,
            prompt: request.code,
            context: {
              language: request.language,
              reviewType: request.reviewType,
              reviewDepth: request.reviewDepth,
              context: request.context,
            },
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            onComplete: async (metadata) => {
              const response: CodeReviewResponse = {
                success: true,
                provider: metadata?.provider || request.provider || 'gemini',
                model: metadata?.model || request.model || 'gemini-2.0-flash',
                response: stream.content,
                latencyMs: metadata?.latencyMs || 0,
                reviewDepth: request.reviewDepth,
                usage: metadata?.tokens || { input: 0, output: 0, total: 0 },
              };

              try {
                await saveToHistory({
                  language: request.language,
                  reviewType: request.reviewType,
                  reviewDepth: request.reviewDepth,
                  code: request.code,
                  provider: response.provider,
                  model: response.model,
                  response: stream.content,
                  latencyMs: response.latencyMs,
                  tokens: response.usage.total,
                });
              } catch {
                // History save failed but response is still valid
              }

              resolve(response);
            },
            onError: (error) => {
              reject({ success: false, error } as CodeReviewError);
            },
          });
        });
      }

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
    [stream, saveToHistory],
  );

  const mutate = useCallback(
    (
      request: CodeReviewRequest,
      options?: {
        onSuccess?: (data: CodeReviewResponse) => void;
        onError?: (error: CodeReviewError) => void;
      },
    ) => {
      mutateAsync(request).then(options?.onSuccess).catch(options?.onError);
    },
    [mutateAsync],
  );

  return {
    ...stream,
    mutate,
    mutateAsync,
    isPending: stream.isStreaming,
    isError: stream.error !== null,
    error: stream.error ? { success: false as const, error: stream.error } : null,
  };
}
