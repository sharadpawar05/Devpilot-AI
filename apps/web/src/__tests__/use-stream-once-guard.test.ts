import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamSession } from '@/hooks/use-stream';
import { aiHistoryApi } from '@/lib/ai-history';

vi.mock('@/lib/ai-history', () => ({
  aiHistoryApi: {
    createSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  },
}));

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
  return {
    ok: true,
    body: { getReader: () => stream.getReader() },
  } as unknown as Response;
}

/**
 * One streamed action must persist exactly one history row, even when the
 * server emits two metadata chunks (provider + engine) for the same stream.
 */
describe('useStreamSession duplicate metadata guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'data: {"type":"token","content":"hello"}',
          'data: {"type":"metadata","provider":"gemini","model":"gemini-3.6-flash","latencyMs":100,"tokens":{"input":1,"output":2,"total":3}}',
          // Second (duplicate) metadata chunk as previously emitted by the engine.
          'data: {"type":"metadata","provider":"gemini","model":"gemini-3.6-flash","latencyMs":110,"tokens":{"input":1,"output":2,"total":3}}',
          'data: [DONE]',
        ]),
      ),
    );
  });

  it('calls onComplete exactly once and creates exactly one history row', async () => {
    const onComplete = vi.fn().mockImplementation(async () => {
      await aiHistoryApi.createSession('token', {
        workflowType: 'playground',
        title: 'Prompt',
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        messages: [{ role: 'user', content: 'hi' }],
      });
    });

    const { result } = renderHook(() => useStreamSession());

    act(() => {
      result.current.startStream({
        workflowType: 'PLAYGROUND',
        prompt: 'hi',
        token: 'token',
        onComplete,
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(aiHistoryApi.createSession).toHaveBeenCalledTimes(1);
  });

  it('a second metadata chunk does not overwrite a completed stream state', async () => {
    const onComplete = vi.fn();

    const { result } = renderHook(() => useStreamSession());

    act(() => {
      result.current.startStream({
        workflowType: 'PLAYGROUND',
        prompt: 'hi',
        token: 'token',
        onComplete,
      });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    // First metadata's latency wins (onComplete ran on the first chunk only).
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.metadata?.latencyMs).toBe(100);
  });
});
