import { useCallback } from 'react';
import { useAuth } from '@/auth';
import type { AIHistorySession, AIHistoryMessage } from '@devpilot/types';
import { aiHistoryApi } from '@/lib/ai-history';
import { useStreamSession } from './use-stream';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface ChatRequest {
  provider: string;
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  stream?: boolean;
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(prompt: string): string {
  const cleaned = prompt.replace(/\n/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57) + '...';
}

export function useChat() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const stream = useStreamSession();

  const createSession = useCallback(
    async (params: {
      provider: string;
      model: string;
      prompt: string;
      response: string;
      latencyMs: number;
      tokens: number;
    }): Promise<AIHistorySession> => {
      if (!token) throw new Error('Not authenticated');
      return aiHistoryApi.createSession(token, {
        workflowType: 'playground',
        title: generateTitle(params.prompt),
        provider: params.provider as AIHistorySession['provider'],
        model: params.model as AIHistorySession['model'],
        messages: [
          {
            id: generateId(),
            role: 'user',
            content: params.prompt,
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

  const appendToSession = useCallback(
    async (
      sessionId: string,
      params: {
        prompt: string;
        response: string;
        latencyMs: number;
        tokens: number;
      },
    ): Promise<AIHistorySession | null> => {
      if (!token) return null;

      const userMessage: AIHistoryMessage = {
        id: generateId(),
        role: 'user',
        content: params.prompt,
        latency: 0,
        tokens: 0,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: AIHistoryMessage = {
        id: generateId(),
        role: 'assistant',
        content: params.response,
        latency: params.latencyMs,
        tokens: params.tokens,
        timestamp: new Date().toISOString(),
      };

      await aiHistoryApi.addMessage(token, sessionId, userMessage);
      return aiHistoryApi.addMessage(token, sessionId, assistantMessage);
    },
    [token],
  );

  const mutateAsync = useCallback(
    async (request: ChatRequest) => {
      if (request.stream) {
        return new Promise<ChatResponse>((resolve, reject) => {
          stream.startStream({
            workflowType: 'PLAYGROUND',
            provider: request.provider,
            model: request.model,
            prompt: request.prompt,
            context: {},
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            onComplete: async (metadata, content) => {
              const response: ChatResponse = {
                success: true,
                provider: metadata?.provider || request.provider,
                model: metadata?.model || request.model,
                response: content,
                latencyMs: metadata?.latencyMs || 0,
                usage: metadata?.tokens || { input: 0, output: 0, total: 0 },
              };

              try {
                if (request.sessionId) {
                  await appendToSession(request.sessionId, {
                    prompt: request.prompt,
                    response: content,
                    latencyMs: response.latencyMs,
                    tokens: response.usage.total,
                  });
                } else {
                  await createSession({
                    provider: request.provider,
                    model: request.model,
                    prompt: request.prompt,
                    response: content,
                    latencyMs: response.latencyMs,
                    tokens: response.usage.total,
                  });
                }
              } catch {
                // History save failed but response is still valid
              }

              resolve(response);
            },
            onError: (error) => {
              reject({ success: false, error } as ChatError);
            },
          });
        });
      }

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

      const response = data as ChatResponse;

      if (request.sessionId) {
        await appendToSession(request.sessionId, {
          prompt: request.prompt,
          response: response.response,
          latencyMs: response.latencyMs,
          tokens: response.usage.total,
        });
      } else {
        await createSession({
          provider: request.provider,
          model: request.model,
          prompt: request.prompt,
          response: response.response,
          latencyMs: response.latencyMs,
          tokens: response.usage.total,
        });
      }

      return response;
    },
    [stream, createSession, appendToSession],
  );

  const mutate = useCallback(
    (
      request: ChatRequest,
      options?: { onSuccess?: (data: ChatResponse) => void; onError?: (error: ChatError) => void },
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

export function useChatHistory() {
  const { session } = useAuth();
  const token = session?.accessToken;

  const getSession = useCallback(
    async (id: string) => {
      if (!token) return null;
      return aiHistoryApi.getSession(token, id);
    },
    [token],
  );

  return { getSession };
}
