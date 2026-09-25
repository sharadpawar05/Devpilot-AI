import { useState, useCallback, useRef, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export interface StreamChunk {
  type: 'token' | 'metadata' | 'error' | 'done';
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  latencyMs?: number;
  error?: { code: string; message: string };
}

export interface StreamState {
  content: string;
  isStreaming: boolean;
  error: { code: string; message: string } | null;
  metadata: {
    provider: string;
    model: string;
    latencyMs: number;
    tokens: { input: number; output: number; total: number };
  } | null;
}

export interface StreamOptions {
  workflowType: string;
  provider?: string;
  model?: string;
  prompt?: string;
  context?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  /** Bearer token required by POST /stream */
  token?: string;
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: (metadata: StreamState['metadata'], content: string) => Promise<void> | void;
  onError?: (error: { code: string; message: string }) => void;
}

const BATCH_INTERVAL = 50;

export function useStreamSession() {
  const [state, setState] = useState<StreamState>({
    content: '',
    isStreaming: false,
    error: null,
    metadata: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const contentBufferRef = useRef('');
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef<StreamOptions | null>(null);
  const totalContentRef = useRef('');

  const flushBatch = useCallback(() => {
    if (contentBufferRef.current) {
      const content = contentBufferRef.current;
      contentBufferRef.current = '';
      totalContentRef.current += content;
      setState((prev) => ({ ...prev, content: prev.content + content }));
    }
    batchTimerRef.current = null;
  }, []);

  const startStream = useCallback(
    (options: StreamOptions) => {
      abortControllerRef.current?.abort();

      contentBufferRef.current = '';
      totalContentRef.current = '';
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }

      optionsRef.current = options;

      setState({
        content: '',
        isStreaming: true,
        error: null,
        metadata: null,
      });

      options.onStart?.();

      if (!options.token) {
        const authError = {
          code: 'UNAUTHORIZED',
          message: 'You must be signed in to use this feature.',
        };
        setState((prev) => ({ ...prev, error: authError, isStreaming: false }));
        options.onError?.(authError);
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const body = {
        workflowType: options.workflowType,
        provider: options.provider,
        model: options.model,
        prompt: options.prompt,
        context: options.context || {},
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        metadata: options.metadata,
      };

      fetch(`${API_BASE_URL}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json();
            throw error.error || { code: 'HTTP_ERROR', message: `HTTP ${response.status}` };
          }

          const reader = response.body?.getReader();
          if (!reader) throw { code: 'NO_READER', message: 'No response body' };

          const decoder = new TextDecoder();
          let buffer = '';
          let done = false;
          let receivedError = false;

          while (!done) {
            const result = await reader.read();
            done = result.done;
            if (done) break;
            if (receivedError) continue;
            const value = result.value;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const chunk: StreamChunk = JSON.parse(data);

                  if (chunk.type === 'token' && chunk.content) {
                    contentBufferRef.current += chunk.content;
                    options.onToken?.(chunk.content);

                    if (!batchTimerRef.current) {
                      batchTimerRef.current = setTimeout(flushBatch, BATCH_INTERVAL);
                    }
                  } else if (chunk.type === 'metadata') {
                    if (receivedError) continue;
                    const remainingBuffer = contentBufferRef.current;
                    contentBufferRef.current = '';
                    if (batchTimerRef.current) {
                      clearTimeout(batchTimerRef.current);
                      batchTimerRef.current = null;
                    }
                    const metadata = {
                      provider: chunk.provider || '',
                      model: chunk.model || '',
                      latencyMs: chunk.latencyMs || 0,
                      tokens: chunk.tokens || { input: 0, output: 0, total: 0 },
                    };
                    const fullContent = totalContentRef.current + remainingBuffer;
                    setState((prev) => ({
                      ...prev,
                      content: fullContent,
                      metadata,
                    }));
                    await options.onComplete?.(metadata, fullContent);
                    setState((prev) => ({ ...prev, isStreaming: false }));
                  } else if (chunk.type === 'error') {
                    receivedError = true;
                    flushBatch();
                    const error = chunk.error || { code: 'UNKNOWN', message: 'Unknown error' };
                    setState((prev) => ({
                      ...prev,
                      error,
                      isStreaming: false,
                    }));
                    options.onError?.(error);
                  } else if (chunk.type === 'done') {
                    if (receivedError) continue;
                    flushBatch();
                    setState((prev) => ({ ...prev, isStreaming: false }));
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }

          flushBatch();
          if (!receivedError) {
            setState((prev) => ({ ...prev, isStreaming: false }));
          }
        })
        .catch((error) => {
          if (error.name === 'AbortError') return;

          const streamError = error.code
            ? error
            : { code: 'NETWORK_ERROR', message: error.message || 'Network error' };

          flushBatch();
          setState((prev) => ({ ...prev, error: streamError, isStreaming: false }));
          options.onError?.(streamError);
        });
    },
    [flushBatch],
  );

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    flushBatch();
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, [flushBatch]);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    contentBufferRef.current = '';
    totalContentRef.current = '';
    setState({
      content: '',
      isStreaming: false,
      error: null,
      metadata: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    reset,
  };
}
