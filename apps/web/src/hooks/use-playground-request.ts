import { useState, useCallback, useRef, useReducer, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Request state enum
export enum RequestState {
  Idle = 'idle',
  Generating = 'generating',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

// Request action types
export enum RequestAction {
  START = 'START',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  CANCEL = 'CANCEL',
  RESET = 'RESET',
  NEW_REQUEST = 'NEW_REQUEST',
}

export interface RequestError {
  code: string;
  message: string;
}

export interface RequestMetadata {
  provider: string;
  model: string;
  latencyMs: number;
  tokens: { input: number; output: number; total: number };
}

interface RequestRecord {
  provider: string;
  model: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}

interface PlaygroundRequestState {
  status: RequestState;
  error: RequestError | null;
  metadata: RequestMetadata | null;
  lastRequest: RequestRecord | null;
  requestId: number;
}

type PlaygroundRequestAction =
  | { type: RequestAction.START; payload: RequestRecord }
  | { type: RequestAction.SUCCESS; payload: RequestMetadata }
  | { type: RequestAction.FAILURE; payload: RequestError }
  | { type: RequestAction.CANCEL }
  | { type: RequestAction.RESET }
  | { type: RequestAction.NEW_REQUEST };

function requestReducer(
  state: PlaygroundRequestState,
  action: PlaygroundRequestAction,
): PlaygroundRequestState {
  switch (action.type) {
    case RequestAction.START:
      return {
        ...state,
        status: RequestState.Generating,
        error: null,
        metadata: null,
        lastRequest: action.payload,
        requestId: state.requestId + 1,
      };

    case RequestAction.SUCCESS:
      return {
        ...state,
        status: RequestState.Success,
        error: null,
        metadata: action.payload,
      };

    case RequestAction.FAILURE:
      return {
        ...state,
        status: RequestState.Failed,
        error: action.payload,
        metadata: null,
      };

    case RequestAction.CANCEL:
      return {
        ...state,
        status: RequestState.Cancelled,
        error: null,
      };

    case RequestAction.RESET:
      return {
        ...state,
        status: RequestState.Idle,
        error: null,
        metadata: null,
      };

    case RequestAction.NEW_REQUEST:
      return initialState();

    default:
      return state;
  }
}

function initialState(): PlaygroundRequestState {
  return {
    status: RequestState.Idle,
    error: null,
    metadata: null,
    lastRequest: null,
    requestId: 0,
  };
}

export interface UsePlaygroundRequestOptions {
  workflowType?: string;
  onComplete?: (metadata: RequestMetadata, content: string) => Promise<void> | void;
  onError?: (error: RequestError) => void;
}

export interface UsePlaygroundRequestReturn {
  // State
  status: RequestState;
  error: RequestError | null;
  metadata: RequestMetadata | null;
  isIdle: boolean;
  isGenerating: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  isCancelled: boolean;

  // Actions
  startRequest: (params: {
    provider: string;
    model: string;
    prompt: string;
    temperature: number;
    maxTokens: number;
  }) => void;
  retryRequest: () => void;
  cancelRequest: () => void;
  resetRequest: () => void;

  // Stream state
  content: string;
  isStreaming: boolean;
  stopStream: () => void;
  resetStream: () => void;
}

export interface StreamChunk {
  type: 'token' | 'metadata' | 'error' | 'done';
  content?: string;
  provider?: string;
  model?: string;
  tokens?: { input: number; output: number; total: number };
  latencyMs?: number;
  error?: { code: string; message: string };
}

const BATCH_INTERVAL = 50;

export function usePlaygroundRequest(
  options: UsePlaygroundRequestOptions = {},
): UsePlaygroundRequestReturn {
  const { workflowType = 'PLAYGROUND', onComplete, onError } = options;

  // State machine
  const [state, dispatch] = useReducer(requestReducer, initialState());

  // Stream state (kept separate for streaming content)
  const [streamContent, setStreamContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentBufferRef = useRef('');
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalContentRef = useRef('');
  const requestIdRef = useRef(0);
  const lastRequestRef = useRef<RequestRecord | null>(null);

  // Flush batched content to state
  const flushBatch = useCallback(() => {
    if (contentBufferRef.current) {
      const content = contentBufferRef.current;
      contentBufferRef.current = '';
      totalContentRef.current += content;
      setStreamContent((prev) => prev + content);
    }
    batchTimerRef.current = null;
  }, []);

  // Cleanup function - resets all stream state
  const cleanupStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    contentBufferRef.current = '';
    totalContentRef.current = '';
    setStreamContent('');
    setIsStreaming(false);
  }, []);

  // Cancel request
  const cancelRequest = useCallback(() => {
    cleanupStream();
    dispatch({ type: RequestAction.CANCEL });
  }, [cleanupStream]);

  // Reset request
  const resetRequest = useCallback(() => {
    cleanupStream();
    dispatch({ type: RequestAction.RESET });
  }, [cleanupStream]);

  // Start a new request
  const startRequest = useCallback(
    (params: {
      provider: string;
      model: string;
      prompt: string;
      temperature: number;
      maxTokens: number;
    }) => {
      // Always clean up previous stream first
      cleanupStream();

      // Store request record for retry
      lastRequestRef.current = params;

      // Dispatch START to state machine
      dispatch({
        type: RequestAction.START,
        payload: params,
      });

      // Generate unique request ID for this request
      requestIdRef.current += 1;
      const currentRequestId = requestIdRef.current;

      // Reset stream content
      setStreamContent('');
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const body = {
        workflowType,
        provider: params.provider,
        model: params.model,
        prompt: params.prompt,
        temperature: params.temperature,
        maxTokens: params.maxTokens,
      };

      fetch(`${API_BASE_URL}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortController.signal,
      })
        .then(async (response) => {
          // Check if this request was cancelled
          if (currentRequestId !== requestIdRef.current) return;

          if (!response.ok) {
            const error = await response.json();
            throw error.error || { code: 'HTTP_ERROR', message: `HTTP ${response.status}` };
          }

          const reader = response.body?.getReader();
          if (!reader) throw { code: 'NO_READER', message: 'No response body' };

          const decoder = new TextDecoder();
          let buffer = '';
          let done = false;

          try {
            while (!done) {
              const result = await reader.read();
              done = result.done;
              if (done) break;
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

                      if (!batchTimerRef.current) {
                        batchTimerRef.current = setTimeout(flushBatch, BATCH_INTERVAL);
                      }
                    } else if (chunk.type === 'metadata') {
                      // Check if request is still current
                      if (currentRequestId !== requestIdRef.current) return;

                      const remainingBuffer = contentBufferRef.current;
                      contentBufferRef.current = '';
                      if (batchTimerRef.current) {
                        clearTimeout(batchTimerRef.current);
                        batchTimerRef.current = null;
                      }

                      const metadata: RequestMetadata = {
                        provider: chunk.provider || params.provider,
                        model: chunk.model || params.model,
                        latencyMs: chunk.latencyMs || 0,
                        tokens: chunk.tokens || { input: 0, output: 0, total: 0 },
                      };

                      const fullContent = totalContentRef.current + remainingBuffer;
                      setStreamContent(fullContent);
                      setIsStreaming(false);

                      // Dispatch SUCCESS
                      dispatch({
                        type: RequestAction.SUCCESS,
                        payload: metadata,
                      });

                      await onComplete?.(metadata, fullContent);
                    } else if (chunk.type === 'error') {
                      // Check if request is still current
                      if (currentRequestId !== requestIdRef.current) return;

                      const finalContent = contentBufferRef.current;
                      flushBatch();
                      const error = chunk.error || { code: 'UNKNOWN', message: 'Unknown error' };

                      setStreamContent((prev) => prev + finalContent);
                      setIsStreaming(false);

                      // Dispatch FAILURE
                      dispatch({
                        type: RequestAction.FAILURE,
                        payload: error,
                      });

                      onError?.(error);
                    } else if (chunk.type === 'done') {
                      flushBatch();
                      setIsStreaming(false);
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          flushBatch();
          setIsStreaming(false);
        })
        .catch((error) => {
          // Check if request was cancelled or superseded
          if (error.name === 'AbortError') return;
          if (currentRequestId !== requestIdRef.current) return;

          const streamError: RequestError = error.code
            ? error
            : { code: 'NETWORK_ERROR', message: error.message || 'Network error' };

          flushBatch();
          setStreamContent((prev) => prev);
          setIsStreaming(false);

          // Dispatch FAILURE
          dispatch({
            type: RequestAction.FAILURE,
            payload: streamError,
          });

          onError?.(streamError);
        });
    },
    [workflowType, onComplete, onError, flushBatch, cleanupStream],
  );

  // Retry the last failed request
  const retryRequest = useCallback(() => {
    if (!lastRequestRef.current) return;
    startRequest(lastRequestRef.current);
  }, [startRequest]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  return {
    // State
    status: state.status,
    error: state.error,
    metadata: state.metadata,
    isIdle: state.status === RequestState.Idle,
    isGenerating: state.status === RequestState.Generating,
    isSuccess: state.status === RequestState.Success,
    isFailed: state.status === RequestState.Failed,
    isCancelled: state.status === RequestState.Cancelled,

    // Actions
    startRequest,
    retryRequest,
    cancelRequest,
    resetRequest,

    // Stream state
    content: streamContent,
    isStreaming,
    stopStream: cancelRequest,
    resetStream: resetRequest,
  };
}
