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

// Helper to create SSE success response
function createSuccessResponse(metadata: Record<string, unknown>) {
  const encoder = new TextEncoder();
  const metadataData = JSON.stringify({ type: 'metadata', ...metadata });

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
              value: encoder.encode(`data: ${metadataData}\n\n`),
            });
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
    expect(result.current.error).toEqual({
      code: 'INVALID_MODEL',
      message: 'Model not found',
    });
    expect(onError).toHaveBeenCalled();
  });

  it('retryRequest uses current provider/model, not failed request', async () => {
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

    // First request fails with gemini
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

    // Retry with CURRENT provider/model (openai/gpt-4o)
    await act(async () => {
      result.current.retryRequest('openai', 'gpt-4o');
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Success);
    expect(result.current.metadata?.provider).toBe('openai');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Verify the retry used the new provider/model
    const secondCall = mockFetch.mock.calls[1][1].body;
    const parsed = JSON.parse(secondCall);
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('gpt-4o');
  });

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

    // First request with gemini fails
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
    expect(result.current.error?.code).toBe('AUTH_ERROR');

    // Switch to openai and succeed
    await act(async () => {
      result.current.startRequest({
        provider: 'openai',
        model: 'gpt-4o',
        prompt: 'test prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Success);
    expect(result.current.metadata?.provider).toBe('openai');
  });

  it('cancelRequest transitions to Cancelled', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves - simulating a pending request
        }),
    );

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

    act(() => {
      result.current.cancelRequest();
    });

    expect(result.current.status).toBe(RequestState.Cancelled);
    expect(result.current.isCancelled).toBe(true);
  });

  it('resetRequest returns to Idle', async () => {
    mockFetch.mockResolvedValue(createErrorResponse('ERROR', 'Failed'));

    const { result } = renderHook(() => usePlaygroundRequest());

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

    act(() => {
      result.current.resetRequest();
    });

    expect(result.current.status).toBe(RequestState.Idle);
    expect(result.current.error).toBeNull();
    expect(result.current.content).toBe('');
  });

  it('consecutive failures do not corrupt state', async () => {
    mockFetch.mockResolvedValue(createErrorResponse('ERROR', 'Failed'));

    const { result } = renderHook(() => usePlaygroundRequest());

    // First failure
    await act(async () => {
      result.current.startRequest({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        prompt: 'first prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Failed);
    expect(result.current.error?.code).toBe('ERROR');

    // Second failure
    await act(async () => {
      result.current.startRequest({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        prompt: 'second prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Failed);
    expect(result.current.error?.code).toBe('ERROR');
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
        prompt: 'first prompt',
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
        prompt: 'second prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Success);
  });

  it('new request after failure starts fresh', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse('ERROR', 'Failed')).mockResolvedValueOnce(
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
    expect(result.current.error).toBeTruthy();

    // New request with different provider
    await act(async () => {
      result.current.startRequest({
        provider: 'openai',
        model: 'gpt-4o',
        prompt: 'new prompt',
        temperature: 0.5,
        maxTokens: 1024,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Success);
    expect(result.current.error).toBeNull();
    expect(result.current.metadata?.provider).toBe('openai');
  });

  it('request only sends current prompt, not history', async () => {
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

    // Verify the prompt in the request body is only the current prompt
    const callBody = mockFetch.mock.calls[0][1].body;
    const parsed = JSON.parse(callBody);
    expect(parsed.prompt).toBe('current prompt only');
    expect(parsed.workflowType).toBe('PLAYGROUND');
  });

  it('startRequest clears previous error and content', async () => {
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
        prompt: 'first prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current.status).toBe(RequestState.Failed);
    expect(result.current.error).toBeTruthy();

    // Start new request - should clear error
    await act(async () => {
      result.current.startRequest({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        prompt: 'second prompt',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Error should be cleared immediately when starting new request
    expect(result.current.error).toBeNull();
  });
});
