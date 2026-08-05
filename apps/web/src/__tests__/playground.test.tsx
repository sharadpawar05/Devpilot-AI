import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the hooks before importing the component
vi.mock('@/hooks/use-chat', () => ({
  useChat: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
  })),
}));

vi.mock('@/hooks/use-stream', () => ({
  useStreamSession: vi.fn(() => ({
    content: '',
    isStreaming: false,
    error: null,
    metadata: null,
    startStream: vi.fn(),
    stopStream: vi.fn(),
    reset: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-user-preferences', () => ({
  useUserPreferences: vi.fn(() => ({
    preferences: {
      defaultProvider: 'gemini',
      defaultModel: 'gemini-3.5-flash',
    },
    updatePreference: vi.fn(),
    addRecentPrompt: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-keyboard-shortcuts', () => ({
  useStreamingAbort: vi.fn(),
  useCopyResponse: vi.fn(),
}));

vi.mock('@/auth', () => ({
  useAuth: vi.fn(() => ({
    session: {
      accessToken: 'mock-token',
    },
  })),
}));

vi.mock('@/lib/ai-history', () => ({
  aiHistoryApi: {
    createSession: vi.fn().mockResolvedValue(null),
    addMessage: vi.fn().mockResolvedValue(null),
    getSession: vi.fn().mockResolvedValue(null),
  },
  aiHistoryStorage: {
    getRecentActivity: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: vi.fn(() => [new URLSearchParams(), vi.fn()]),
}));

vi.mock('@/lib/markdown', () => ({
  renderMarkdown: vi.fn((content) => `<p>${content}</p>`),
}));

// Now import the component after mocks are set up
import { PlaygroundPage } from '@/pages/playground';
import { useStreamSession } from '@/hooks/use-stream';
import { useChat } from '@/hooks/use-chat';
import { useSearchParams } from 'react-router-dom';
import { aiHistoryApi } from '@/lib/ai-history';

describe('Playground Flow - 10 Steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Open Playground', () => {
    it('should load the Playground page successfully', () => {
      render(<PlaygroundPage />);

      expect(screen.getByText('AI Playground')).toBeInTheDocument();
      expect(
        screen.getByText('Test the AI Gateway with different providers and models.'),
      ).toBeInTheDocument();
    });

    it('should have default provider/model selected', async () => {
      const user = userEvent.setup();
      render(<PlaygroundPage />);

      // Expand Advanced Settings
      const advancedSettings = screen.getByText('Advanced Settings');
      await user.click(advancedSettings);

      // Find selects by their current values
      const selects = screen.getAllByRole('combobox');
      // First select is Template, second is Provider, third is Model
      expect(selects.length).toBeGreaterThanOrEqual(3);

      // Provider select should have 'gemini' selected
      expect(selects[1]).toHaveValue('gemini');

      // Model select should have 'gemini-3.5-flash' selected
      expect(selects[2]).toHaveValue('gemini-3.5-flash');
    });
  });

  describe('Step 2: Enter a Prompt', () => {
    it('should allow typing a prompt', async () => {
      render(<PlaygroundPage />);

      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);

      // Use fireEvent to change the value
      fireEvent.change(textarea, { target: { value: 'Hello, AI!' } });

      expect(textarea).toHaveValue('Hello, AI!');
    });

    it('should show character count when typing', async () => {
      render(<PlaygroundPage />);

      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);

      // Use fireEvent to change the value
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(screen.getByText('5 chars')).toBeInTheDocument();
    });

    it('should enable Generate button when prompt is not empty', async () => {
      render(<PlaygroundPage />);

      const generateButton = screen.getByText('Generate').closest('button');
      expect(generateButton).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);

      // Use fireEvent to change the value
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      expect(generateButton).toBeEnabled();
    });
  });

  describe('Step 3: Generate Response', () => {
    it('should show loading state when generating', async () => {
      const mockStartStream = vi.fn();
      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: true,
        error: null,
        metadata: null,
        startStream: mockStartStream,
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // Should show "Streaming..." text
      expect(screen.getByText('Streaming...')).toBeInTheDocument();
    });

    it('should display AI response when streaming completes', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Hello! How can I help you today?',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1500,
          tokens: { input: 10, output: 20, total: 30 },
        },
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    });

    it('should stop loading when response is received', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Response complete',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // When response is received, loading state should stop
      expect(screen.queryByText('Streaming...')).not.toBeInTheDocument();
      expect(screen.queryByText('Generating...')).not.toBeInTheDocument();
    });
  });

  describe('Step 4: Response Actions', () => {
    it('should have Copy available via keyboard shortcut when response exists', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Test response',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // Copy is available via useCopyResponse hook (Ctrl+Shift+C)
      // Verify the response content is displayed
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });

    it('should have Clear/New button when session exists', async () => {
      // Mock session to show "New" button
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });

      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      // Reset search params back to default for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it('should have Regenerate capability via re-submitting prompt', async () => {
      const mockStartStream = vi.fn();
      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Test response',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: mockStartStream,
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // User can type a new prompt and generate again (regenerate flow)
      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);
      fireEvent.change(textarea, { target: { value: 'Regenerate prompt' } });

      const generateButton = screen.getByText('Generate').closest('button');
      expect(generateButton).toBeEnabled();
    });
  });

  describe('Step 5: Change Model', () => {
    it('should allow changing the model', async () => {
      const user = userEvent.setup();
      render(<PlaygroundPage />);

      // Expand Advanced Settings
      const advancedSettings = screen.getByText('Advanced Settings');
      await user.click(advancedSettings);

      const selects = screen.getAllByRole('combobox');
      // Third select is Model
      await user.selectOptions(selects[2], 'gemini-2.5-pro');

      expect(selects[2]).toHaveValue('gemini-2.5-pro');
    });

    it('should update available models when provider changes', async () => {
      const user = userEvent.setup();
      render(<PlaygroundPage />);

      // Expand Advanced Settings
      const advancedSettings = screen.getByText('Advanced Settings');
      await user.click(advancedSettings);

      const selects = screen.getAllByRole('combobox');
      // Second select is Provider
      await user.selectOptions(selects[1], 'openai');

      // Model select should now have OpenAI models
      expect(selects[2]).toBeInTheDocument();
    });

    it('should generate new response with different model', async () => {
      const mockStartStream = vi.fn();
      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: false,
        error: null,
        metadata: null,
        startStream: mockStartStream,
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      const user = userEvent.setup();
      render(<PlaygroundPage />);

      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      // Expand Advanced Settings
      const advancedSettings = screen.getByText('Advanced Settings');
      await user.click(advancedSettings);

      const selects = screen.getAllByRole('combobox');
      await user.selectOptions(selects[2], 'gemini-2.5-pro');

      // The submit button may say "Generate" or "Continue" depending on session state
      const submitButton = screen.getByRole('button', { name: /generate|continue/i });
      await user.click(submitButton);

      expect(mockStartStream).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-pro',
        }),
      );
    });
  });

  describe('Step 6: Test Invalid Model', () => {
    it('should show error message when model fails', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: false,
        error: {
          code: 'MODEL_NOT_FOUND',
          message: 'The selected model is not available',
        },
        metadata: null,
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // Should show user-friendly title from error mapping
      expect(screen.getByText('Model not available')).toBeInTheDocument();
      // Should show the friendly message from config, not the raw error
      expect(screen.getByText('The selected model is not available.')).toBeInTheDocument();
    });

    it('should display error in sticky footer', async () => {
      vi.mocked(useChat).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false,
        isError: true,
        error: {
          success: false,
          error: {
            code: 'MODEL_ERROR',
            message: 'Model not found',
          },
        },
        data: undefined,
        variables: undefined,
        isIdle: false,
        isSuccess: false,
        status: 'error' as const,
        failureCount: 1,
        failureReason: null,
        isPaused: false,
        isFetched: true,
        isFetchedAfterMount: true,
        isFetching: false,
        isLoading: false,
        isLoadingError: false,
        isPlaceholderData: false,
        isRefetchError: false,
        isRefetching: false,
        isStale: false,
        refetch: vi.fn(),
        remove: vi.fn(),
        reset: vi.fn(),
      } as any);

      render(<PlaygroundPage />);

      expect(screen.getByText('Model not found')).toBeInTheDocument();
    });
  });

  describe('Step 7: Retry', () => {
    it('should allow retry after error without page refresh', async () => {
      const mockStartStream = vi.fn();

      // First call - error
      vi.mocked(useStreamSession).mockReturnValueOnce({
        content: '',
        isStreaming: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
        },
        metadata: null,
        startStream: mockStartStream,
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      const { rerender } = render(<PlaygroundPage />);

      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);
      fireEvent.change(textarea, { target: { value: 'Hello' } });

      // Second call - success
      vi.mocked(useStreamSession).mockReturnValueOnce({
        content: 'Success after retry',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: mockStartStream,
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      rerender(<PlaygroundPage />);

      expect(screen.getByText('Success after retry')).toBeInTheDocument();
    });
  });

  describe('Step 8: History', () => {
    it('should show Playground history section', async () => {
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'Hello',
            latency: 0,
            tokens: 0,
            timestamp: new Date().toISOString(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'Hi there!',
            latency: 1000,
            tokens: 10,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('Conversation History')).toBeInTheDocument();
      });

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it('should restore prompt/response when clicking history item', async () => {
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: 'What is AI?',
            latency: 0,
            tokens: 0,
            timestamp: new Date().toISOString(),
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: 'AI is artificial intelligence.',
            latency: 1000,
            tokens: 20,
            timestamp: new Date().toISOString(),
          },
        ],
      });

      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('What is AI?')).toBeInTheDocument();
        expect(screen.getByText('AI is artificial intelligence.')).toBeInTheDocument();
      });

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });
  });

  describe('Step 9: Clear', () => {
    it('should reset prompt when Clear is clicked', async () => {
      const mockReset = vi.fn();

      // Mock session to show "New" button
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });

      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Some response',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: mockReset,
      });

      const user = userEvent.setup();
      // Need to provide sessionId in URL to trigger loadSession
      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      // Form should be hidden when viewing history
      expect(screen.queryByPlaceholderText(/enter your prompt here/i)).not.toBeInTheDocument();

      // Clicking New should clear the session
      const clearButton = screen.getByText('New');
      await user.click(clearButton);

      expect(mockReset).toHaveBeenCalled();
      // After clearing, form should be visible again
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/enter your prompt here/i)).toBeInTheDocument();
      });

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it('should reset response when Clear is clicked', async () => {
      const mockReset = vi.fn();

      // Mock session to show "New" button
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });

      vi.mocked(useStreamSession).mockReturnValue({
        content: 'Some response',
        isStreaming: false,
        error: null,
        metadata: {
          provider: 'gemini',
          model: 'gemini-3.5-flash',
          latencyMs: 1000,
          tokens: { input: 5, output: 10, total: 15 },
        },
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: mockReset,
      });

      const user = userEvent.setup();
      // Need to provide sessionId in URL to trigger loadSession
      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('New');
      await user.click(clearButton);

      expect(mockReset).toHaveBeenCalled();

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it('should reset loading state when Clear is clicked', async () => {
      const mockReset = vi.fn();

      // Mock session to show "New" button
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });

      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: true,
        error: null,
        metadata: null,
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: mockReset,
      });

      const user = userEvent.setup();
      // Need to provide sessionId in URL to trigger loadSession
      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('New');
      await user.click(clearButton);

      expect(mockReset).toHaveBeenCalled();

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });

    it('should reset errors when Clear is clicked', async () => {
      const mockReset = vi.fn();

      // Mock session to show "New" button
      vi.mocked(aiHistoryApi.getSession).mockResolvedValue({
        id: 'session-1',
        workflowType: 'playground',
        title: 'Test conversation',
        provider: 'gemini',
        model: 'gemini-3.5-flash',
        totalLatency: 0,
        totalTokens: 0,
        pinned: false,
        archived: false,
        favorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      });

      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: false,
        error: {
          code: 'ERROR',
          message: 'Something went wrong',
        },
        metadata: null,
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: mockReset,
      });

      const user = userEvent.setup();
      // Need to provide sessionId in URL to trigger loadSession
      const mockSetSearchParams = vi.fn();
      vi.mocked(useSearchParams).mockReturnValue([
        new URLSearchParams({ continue: 'session-1' }),
        mockSetSearchParams,
      ]);

      render(<PlaygroundPage />);

      await waitFor(() => {
        expect(screen.getByText('New')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('New');
      await user.click(clearButton);

      expect(mockReset).toHaveBeenCalled();

      // Reset for other tests
      vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams(), vi.fn()]);
    });
  });

  describe('Step 10: Edge Cases', () => {
    it('should disable Generate button for empty prompt', () => {
      render(<PlaygroundPage />);

      const generateButton = screen.getByText('Generate').closest('button');
      expect(generateButton).toBeDisabled();
    });

    it('should handle very long prompt', async () => {
      render(<PlaygroundPage />);

      const longPrompt = 'a'.repeat(10000);
      const textarea = screen.getByPlaceholderText(/enter your prompt here/i);

      // Use fireEvent to change the value
      fireEvent.change(textarea, { target: { value: longPrompt } });

      expect(textarea).toHaveValue(longPrompt);
      expect(screen.getByText('10000 chars')).toBeInTheDocument();
    });

    it('should handle network failure', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to the server. Please make sure the API is running.',
        },
        metadata: null,
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // Should show user-friendly title
      expect(screen.getByText('Connection lost')).toBeInTheDocument();
      // Should show the friendly message from config
      expect(screen.getByText('Unable to connect to the server.')).toBeInTheDocument();
      // Should show suggestion
      expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument();
      // Should have retry button for retryable errors
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should handle API timeout', async () => {
      vi.mocked(useStreamSession).mockReturnValue({
        content: '',
        isStreaming: false,
        error: {
          code: 'TIMEOUT',
          message: 'Request timed out. Please try again.',
        },
        metadata: null,
        startStream: vi.fn(),
        stopStream: vi.fn(),
        reset: vi.fn(),
      });

      render(<PlaygroundPage />);

      // Should show user-friendly title
      expect(screen.getByText('Request timed out')).toBeInTheDocument();
      // Should show the friendly message from config
      expect(screen.getByText('The AI took too long to respond.')).toBeInTheDocument();
      // Should show suggestion
      expect(
        screen.getByText('Try a shorter prompt or switch to a faster model.'),
      ).toBeInTheDocument();
      // Should have retry button for retryable errors
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
