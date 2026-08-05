import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlaygroundRequest, RequestState } from './use-playground-request';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create a mock response that resolves immediately
function createMockResponse(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
    body: {
      getReader: () => ({
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      }),
    },
  };
}

// Helper to create SSE error response
function createErrorResponse(code: string, message: string) {
  const encoder = new TextEncoder();
  const errorData = JSON.stringify({ type: 'error', error: { code, message } });

  return {
    ok: true,
    json: () => Promise.resolve({}),
    body: {
      getReader: () => {
        let called = false;
        return {
          read: vi.fn().mockImplementation(() => {
            if (called) return Promise.resolve({ done: true, value: undefined });
            called = true;
            return Promise.resolve({
              done: false,
              value: encoder.encode(`data: ${errorData}\n\n`),
            });
          }),
          releaseLock: vi.fn(),
        };
      },
    },
  };
}

// Helper to create SSE success response with metadata and done
function createSuccessResponse(metadata: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const metadataData = JSON.stringify({ type: 'metadata', ...metadata });
  const doneData = JSON.stringify({ type: 'done' });

  return {
    ok: true,
    json: () => Promise.resolve({}),
    body: {
      getReader: () => {
        let callCount = 0;
        return {
          read: vi.fn().mockImplementation(() => {
            if (callCount >= 2) return Promise.resolve({ done: true, value: undefined });
            if (callCount === 0) {
              callCount++;
              return Promise.resolve({
                done: false,
                value: encoder.encode(`data: ${metadataData}\n\n`),
              });
            }
            callCount++;
            return Promise.resolve({
              done: false,
              value: encoder.encode(`data: ${doneData}\n\n`),
            });
          }),
          releaseLock: vi.fn(),
        };
      },
    },
  };
}

// Helper to create SSE streaming response with tokens, metadata, and done
function createStreamingResponse(tokens: string[], metadata: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const metadataData = JSON.stringify({ type: 'metadata', ...metadata });
  const doneData = JSON.stringify({ type: 'done' });

  return {
    ok: true,
    json: () => Promise.resolve({}),
    body: {
      getReader: () => {
        let callCount = 0;
        const totalCalls = tokens.length + 2; // tokens + metadata + done
        return {
          read: vi.fn().mockImplementation(() => {
            if (callCount >= totalCalls) return Promise.resolve({ done: true, value: undefined });

            if (callCount < tokens.length) {
              const tokenData = JSON.stringify({ type: 'token', content: tokens[callCount] });
              callCount++;
              return Promise.resolve({
                done: false,
                value: encoder.encode(`data: ${tokenData}\n\n`),
              });
            } else if (callCount === tokens.length) {
              callCount++;
              return Promise.resolve({
                done: false,
                value: encoder.encode(`data: ${metadataData}\n\n`),
              });
            } else {
              callCount++;
              return Promise.resolve({
                done: false,
                value: encoder.encode(`data: ${doneData}\n\n`),
              });
            }
          }),
          releaseLock: vi.fn(),
        };
      },
    },
  };
}

describe('usePlaygroundRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State transitions', () => {
    it('starts in Idle state', () => {
      const { result } = renderHook(() => usePlaygroundRequest());

      expect(result.current.status).toBe(RequestState.Idle);
      expect(result.current.isIdle).toBe(true);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.content).toBe('');
    });

    it('transitions to Generating on startRequest', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      const { result } = renderHook(() => usePlaygroundRequest());

      act(() => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test prompt',
          temperature: 0.7,
          maxTokens: 2048,
        });
      });

      expect(result.current.status).toBe(RequestState.Generating);
      expect(result.current.isGenerating).toBe(true);
    });

    it('transitions to Success on successful completion', async () => {
      const onComplete = vi.fn();
      mockFetch.mockResolvedValue(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 1000,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest({ onComplete }));

      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test prompt',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Success);
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isGenerating).toBe(false);
      expect(onComplete).toHaveBeenCalled();
    });

    it('transitions to Failed on error', async () => {
      const onError = vi.fn();
      mockFetch.mockResolvedValue(createErrorResponse('INVALID_MODEL', 'Model not found'));

      const { result } = renderHook(() => usePlaygroundRequest({ onError }));

      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'invalid-model',
          prompt: 'test prompt',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Failed);
      expect(result.current.isFailed).toBe(true);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toEqual({
        code: 'INVALID_MODEL',
        message: 'Model not found',
      });
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Loading state', () => {
    it('isGenerating is true only during Generating state', async () => {
      mockFetch.mockResolvedValue(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 500,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      // Initial state
      expect(result.current.isGenerating).toBe(false);

      // Start request
      act(() => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
      });

      expect(result.current.isGenerating).toBe(true);

      // Wait for completion
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isSuccess).toBe(true);
    });

    it('isGenerating clears on error', async () => {
      mockFetch.mockResolvedValue(createErrorResponse('ERROR', 'Failed'));

      const { result } = renderHook(() => usePlaygroundRequest());

      act(() => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
      });

      expect(result.current.isGenerating).toBe(true);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isFailed).toBe(true);
    });

    it('isGenerating clears on cancel', async () => {
      mockFetch.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      act(() => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
      });

      expect(result.current.isGenerating).toBe(true);

      act(() => {
        result.current.cancelRequest();
      });

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isCancelled).toBe(true);
    });
  });

  describe('Retry logic', () => {
    it('retryRequest uses current provider/model', async () => {
      mockFetch
        .mockResolvedValueOnce(createErrorResponse('TIMEOUT', 'Request timed out'))
        .mockResolvedValueOnce(
          createSuccessResponse({
            provider: 'openai',
            model: 'gpt-4o',
            latencyMs: 500,
            tokens: { input: 10, output: 5, total: 15 },
          }),
        );

      const { result } = renderHook(() => usePlaygroundRequest());

      // First request fails
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test prompt',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Failed);

      // Retry with CURRENT provider/model
      await act(async () => {
        result.current.retryRequest('openai', 'gpt-4o');
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Success);
      expect(result.current.metadata?.provider).toBe('openai');

      // Verify the retry used the new provider/model
      const secondCall = mockFetch.mock.calls[1][1].body;
      const parsed = JSON.parse(secondCall);
      expect(parsed.provider).toBe('openai');
      expect(parsed.model).toBe('gpt-4o');
    });
  });

  describe('Streaming completion', () => {
    it('successful generation finishes and clears loading', async () => {
      mockFetch.mockResolvedValue(
        createStreamingResponse(['Hello', ' world'], {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 500,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Stream should be complete
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.content).toBe('Hello world');
    });

    it('response renders after completion', async () => {
      mockFetch.mockResolvedValue(
        createStreamingResponse(['Test', ' response'], {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 100,
          tokens: { input: 5, output: 2, total: 7 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      expect(result.current.content).toBe('Test response');
      expect(result.current.isSuccess).toBe(true);
    });

    it('progress resets after completion', async () => {
      mockFetch.mockResolvedValue(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 100,
          tokens: { input: 5, output: 2, total: 7 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      // First request
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'first',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.isSuccess).toBe(true);

      // Second request
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'second',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('Request isolation', () => {
    it('changing provider/model starts fresh request', async () => {
      mockFetch
        .mockResolvedValueOnce(createErrorResponse('AUTH_ERROR', 'Invalid API key'))
        .mockResolvedValueOnce(
          createSuccessResponse({
            provider: 'openai',
            model: 'gpt-4o',
            latencyMs: 500,
            tokens: { input: 10, output: 5, total: 15 },
          }),
        );

      const { result } = renderHook(() => usePlaygroundRequest());

      // First request fails
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Failed);

      // Switch to openai
      await act(async () => {
        result.current.startRequest({
          provider: 'openai',
          model: 'gpt-4o',
          prompt: 'test',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Success);
      expect(result.current.error).toBeNull();
    });

    it('new request clears previous error', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse('ERROR', 'Failed')).mockResolvedValueOnce(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 500,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      // First request fails
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'first',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.error).toBeTruthy();

      // Start new request
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'second',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Error should be cleared immediately
      expect(result.current.error).toBeNull();
    });

    it('consecutive failures do not corrupt state', async () => {
      mockFetch.mockResolvedValue(createErrorResponse('ERROR', 'Failed'));

      const { result } = renderHook(() => usePlaygroundRequest());

      // First failure
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'first',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Failed);

      // Second failure
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'second',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Failed);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.content).toBe('');
    });

    it('consecutive successful requests work correctly', async () => {
      mockFetch.mockResolvedValue(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 500,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      // First success
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'first',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Success);

      // Second success
      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'second',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      expect(result.current.status).toBe(RequestState.Success);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  describe('Prompt payload', () => {
    it('request only sends current prompt', async () => {
      mockFetch.mockResolvedValue(
        createSuccessResponse({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          latencyMs: 500,
          tokens: { input: 10, output: 5, total: 15 },
        }),
      );

      const { result } = renderHook(() => usePlaygroundRequest());

      await act(async () => {
        result.current.startRequest({
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          prompt: 'current prompt only',
          temperature: 0.7,
          maxTokens: 2048,
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      const callBody = mockFetch.mock.calls[0][1].body;
      const parsed = JSON.parse(callBody);
      expect(parsed.prompt).toBe('current prompt only');
      expect(parsed.workflowType).toBe('PLAYGROUND');
    });
  });
});
