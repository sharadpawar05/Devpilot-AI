import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Send,
  Loader2,
  AlertCircle,
  Zap,
  History,
  ArrowLeft,
  User,
  Bot,
  StopCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat, useChatHistory, type ChatResponse } from '@/hooks/use-chat';
import { StreamingResponse } from '@/components/ai';
import { StreamStatus, StreamControls } from '@/components/ai';
import { renderMarkdown } from '@/lib/markdown';
import type { AIHistorySession } from '@devpilot/types';

const PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
] as const;

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-flash-latest', label: 'Gemini Flash (Latest)' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  ],
  openrouter: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
  ],
};

export function PlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-flash-latest');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [currentSession, setCurrentSession] = useState<AIHistorySession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const chat = useChat();
  const { getSession } = useChatHistory();

  const availableModels = MODELS[provider] ?? MODELS.gemini;

  useEffect(() => {
    const sessionId = searchParams.get('continue');
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [searchParams]);

  async function loadSession(sessionId: string) {
    setIsLoadingSession(true);
    try {
      const session = await getSession(sessionId);
      if (session) {
        setCurrentSession(session);
        setProvider(session.provider);
        setModel(session.model);
      }
    } finally {
      setIsLoadingSession(false);
    }
  }

  function handleProviderChange(newProvider: string) {
    setProvider(newProvider);
    const models = MODELS[newProvider];
    if (models?.length) {
      setModel(models[0].value);
    }
  }

  function handleClearSession() {
    setCurrentSession(null);
    setSearchParams({});
    setResult(null);
    setPrompt('');
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || chat.isPending) return;

      const currentPrompt = prompt.trim();
      setPrompt('');

      chat
        .mutateAsync({
          provider,
          model,
          prompt: currentPrompt,
          temperature,
          maxTokens,
          sessionId: currentSession?.id,
          stream: true,
        })
        .then((data) => {
          setResult(data);
          if (!currentSession) {
            loadRecentSession();
          }
        })
        .catch(() => {
          // Error is handled by the hook
        });
    },
    [prompt, chat, provider, model, temperature, maxTokens, currentSession],
  );

  const handleStop = useCallback(() => {
    chat.stopStream();
  }, [chat]);

  const handleRetry = useCallback(() => {
    if (result) {
      setResult(null);
      chat.reset();
    }
  }, [result, chat]);

  const handleCopy = useCallback(async () => {
    if (chat.content || result?.response) {
      await navigator.clipboard.writeText(chat.content || result?.response || '');
    }
  }, [chat.content, result]);

  const handleRegenerate = useCallback(() => {
    setResult(null);
    chat.reset();
  }, [chat]);

  async function loadRecentSession() {
    const sessions = await import('@/lib/ai-history').then((m) =>
      m.aiHistoryStorage.getRecentActivity(1),
    );
    if (sessions[0]) {
      const session = await getSession(sessions[0].id);
      if (session) {
        setCurrentSession(session);
      }
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          {currentSession && (
            <button
              onClick={handleClearSession}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {currentSession ? currentSession.title : 'AI Playground'}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {currentSession
                ? `Continuing conversation · ${currentSession.messages.length} messages`
                : 'Test the AI Gateway with different providers and models.'}
            </p>
          </div>
        </div>
      </div>

      {isLoadingSession ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Compact Settings Row */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="min-w-[140px]">
              <label className="text-xs font-medium text-muted-foreground">Provider</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[160px]">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {availableModels.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[120px]">
              <label className="text-xs font-medium text-muted-foreground">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </div>

            <div className="min-w-[100px]">
              <label className="text-xs font-medium text-muted-foreground">Max Tokens</label>
              <input
                type="number"
                min="1"
                max="100000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Prompt Input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here..."
              rows={3}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex flex-col gap-2">
              {chat.isStreaming ? (
                <Button type="button" onClick={handleStop} variant="destructive" className="h-auto">
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!prompt.trim() || chat.isPending}
                  className="h-auto"
                >
                  {chat.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </form>

          {/* Error Display */}
          {chat.isError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {chat.error?.error?.message ?? 'An unexpected error occurred'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conversation History (when continuing a session) */}
          {currentSession && currentSession.messages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" />
                Previous Messages ({currentSession.messages.length})
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-input bg-muted/20 p-3">
                {currentSession.messages.slice(-6).map((message) => (
                  <div key={message.id} className="flex items-start gap-2">
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <p className="flex-1 text-xs text-muted-foreground line-clamp-2">
                      {message.content.slice(0, 120)}
                      {message.content.length > 120 ? '...' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response Area - Full Width */}
          {(chat.isStreaming || chat.content) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <StreamStatus
                  isStreaming={chat.isStreaming}
                  error={chat.error?.error || null}
                  metadata={chat.metadata}
                />
                <StreamControls
                  isStreaming={chat.isStreaming}
                  hasContent={!!chat.content}
                  hasError={!!chat.error}
                  onStop={handleStop}
                  onRetry={handleRetry}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                />
              </div>

              <div className="min-h-[300px] max-h-[600px] rounded-md border bg-muted/30 p-4 overflow-hidden">
                <StreamingResponse
                  content={chat.content}
                  isStreaming={chat.isStreaming}
                  className="h-full"
                  autoScroll={true}
                />
              </div>
            </div>
          )}

          {/* Completed Response (non-streaming fallback) */}
          {result && !chat.isStreaming && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span className="font-medium">{result.provider}</span>
                <span>/</span>
                <span>{result.model}</span>
                <span>/</span>
                <span>{result.latencyMs}ms</span>
              </div>

              <div className="min-h-[300px] max-h-[600px] rounded-md border bg-muted/30 p-4 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(result.response),
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Input Tokens</p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.usage.input.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Output Tokens</p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.usage.output.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-md border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Tokens</p>
                  <p className="mt-1 text-lg font-semibold">
                    {result.usage.total.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!chat.content && !result && !currentSession && !chat.isError && !chat.isPending && (
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <p className="text-sm">Send a prompt to see the response</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
