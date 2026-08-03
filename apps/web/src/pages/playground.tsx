import { useState, useEffect, useRef, useCallback } from 'react';
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
  Copy,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Settings2,
  PanelLeftClose,
  PanelRightClose,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useChat, useChatHistory, type ChatResponse } from '@/hooks/use-chat';
import { useStreamSession } from '@/hooks/use-stream';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
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

const PROMPT_TEMPLATES = [
  { value: 'custom', label: 'Custom Prompt' },
  { value: 'code-review', label: 'Code Review' },
  { value: 'explain-code', label: 'Explain Code' },
  { value: 'refactor', label: 'Refactor Code' },
  { value: 'write-tests', label: 'Write Tests' },
  { value: 'debug', label: 'Debug Error' },
  { value: 'summarize', label: 'Summarize' },
  { value: 'translate', label: 'Translate' },
];

const TEMPLATE_PROMPTS: Record<string, string> = {
  'code-review':
    'Review the following code for potential bugs, security issues, and improvements:\n\n```\n// paste code here\n```',
  'explain-code':
    'Explain the following code in detail, including its purpose, logic flow, and any patterns used:\n\n```\n// paste code here\n```',
  refactor:
    'Refactor the following code to improve readability, performance, and maintainability:\n\n```\n// paste code here\n```',
  'write-tests':
    'Write comprehensive unit tests for the following code:\n\n```\n// paste code here\n```',
  debug:
    'Help me debug the following error. Explain the root cause and provide a fix:\n\nError: \n```\n// paste error here\n```\n\nCode:\n```\n// paste code here\n```',
  summarize: 'Summarize the following text concisely:',
  translate: 'Translate the following text to English:',
};

export function PlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('gemini-flash-latest');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [template, setTemplate] = useState('custom');
  const [showVariables, setShowVariables] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [currentSession, setCurrentSession] = useState<AIHistorySession | null>(null);
  const [_isLoadingSession, setIsLoadingSession] = useState(false);
  const [mobileView, setMobileView] = useState<'config' | 'response'>('config');

  const responseRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useChat();
  const { getSession } = useChatHistory();
  const stream = useStreamSession();

  const availableModels = MODELS[provider] ?? MODELS.gemini;
  const isStreaming = stream.isStreaming;
  const isGenerating = chat.isPending || isStreaming;

  useEffect(() => {
    const sessionId = searchParams.get('continue');
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (stream.content && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [stream.content]);

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

  function handleTemplateChange(value: string) {
    setTemplate(value);
    if (value !== 'custom' && TEMPLATE_PROMPTS[value]) {
      setPrompt(TEMPLATE_PROMPTS[value]);
    }
  }

  function handleClearSession() {
    setCurrentSession(null);
    setSearchParams({});
    setResult(null);
    stream.reset();
    setPrompt('');
    setMobileView('config');
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isGenerating) return;

      setMobileView('response');

      stream.startStream({
        workflowType: 'PLAYGROUND',
        provider,
        model,
        prompt: prompt.trim(),
        temperature,
        maxTokens,
        onComplete: async (metadata, content) => {
          if (metadata) {
            setResult({
              success: true,
              provider: metadata.provider,
              model: metadata.model,
              response: content,
              latencyMs: metadata.latencyMs,
              usage: metadata.tokens,
            });
          }
          if (!currentSession) {
            loadRecentSession();
          }
        },
      });

      setPrompt('');
    },
    [prompt, isGenerating, provider, model, temperature, maxTokens, currentSession, stream],
  );

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

  function handleCopyResponse() {
    const text = stream.content || result?.response;
    if (text) {
      navigator.clipboard.writeText(text);
    }
  }

  function handleDownloadMarkdown() {
    const text = stream.content || result?.response;
    if (text) {
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playground-response-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleRegenerate() {
    if (!result?.response || isGenerating) return;
    setPrompt(result.response);
    setResult(null);
    stream.reset();
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const hasResponse = !!(stream.content || result?.response);
  const responseContent = stream.content || result?.response || '';
  const responseMetadata =
    stream.metadata ||
    (result
      ? {
          provider: result.provider,
          model: result.model,
          latencyMs: result.latencyMs,
          tokens: result.usage,
        }
      : null);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Panel - Configuration */}
      <div
        className={cn(
          'flex w-full flex-col border-r border-border lg:w-[38%]',
          mobileView === 'response' && hasResponse ? 'hidden lg:flex' : 'flex',
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          {currentSession && (
            <button
              onClick={handleClearSession}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">
              {currentSession ? currentSession.title : 'AI Playground'}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {currentSession
                ? `Continuing conversation · ${currentSession.messages.length} messages`
                : 'Test the AI Gateway with different providers and models.'}
            </p>
          </div>
          {currentSession && (
            <button
              onClick={handleClearSession}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              New
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Prompt Template Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <div className="relative">
                <select
                  value={template}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {PROMPT_TEMPLATES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Prompt Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="prompt" className="text-xs font-medium text-muted-foreground">
                  Prompt
                </label>
                <span className="text-xs text-muted-foreground">
                  {prompt.length > 0 && `${prompt.length} chars`}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter your prompt here... (Ctrl+Enter to send)"
                rows={10}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Variables Section */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {showVariables ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Variables
              </button>
              {showVariables && (
                <div className="space-y-2 rounded-lg border border-dashed border-input p-3">
                  {Object.keys(variables).length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No variables defined. Use {'{{variable_name}}'} in your prompt.
                    </p>
                  )}
                  <div className="space-y-2">
                    {Object.entries(variables).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <input
                          value={key}
                          onChange={(e) => {
                            const newVars = { ...variables };
                            delete newVars[key];
                            newVars[e.target.value] = value;
                            setVariables(newVars);
                          }}
                          placeholder="Name"
                          className="w-1/3 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <input
                          value={value}
                          onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                          placeholder="Value"
                          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newVars = { ...variables };
                            delete newVars[key];
                            setVariables(newVars);
                          }}
                          className="rounded-md px-2 text-xs text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setVariables({ ...variables, '': '' })}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add variable
                  </button>
                </div>
              )}
            </div>

            {/* Advanced Settings */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced" className="border border-border rounded-lg px-3">
                <AccordionTrigger className="text-xs font-medium py-2.5 hover:no-underline">
                  <span className="flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    Advanced Settings
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {/* Provider & Model */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Provider</label>
                      <div className="relative">
                        <select
                          value={provider}
                          onChange={(e) => handleProviderChange(e.target.value)}
                          className="w-full appearance-none rounded-md border border-input bg-background px-2.5 py-1.5 pr-7 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Model</label>
                      <div className="relative">
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full appearance-none rounded-md border border-input bg-background px-2.5 py-1.5 pr-7 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {availableModels.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* Temperature */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Temperature
                      </label>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {temperature}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Max Tokens</label>
                    <input
                      type="number"
                      min="1"
                      max="100000"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </form>
        </div>

        {/* Sticky Generate Button */}
        <div className="border-t border-border px-5 py-3">
          {chat.isError && (
            <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  {chat.error?.error?.message ?? 'An unexpected error occurred'}
                </p>
              </div>
            </div>
          )}
          <Button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="w-full"
            size="default"
            onClick={handleSubmit}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isStreaming ? 'Streaming...' : 'Generating...'}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {currentSession ? 'Continue' : 'Generate'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right Panel - Response */}
      <div
        className={cn(
          'flex flex-1 flex-col bg-muted/20',
          mobileView === 'config' && !hasResponse ? 'hidden lg:flex' : 'flex',
        )}
      >
        {/* Response Header */}
        {hasResponse && responseMetadata && (
          <div className="flex items-center justify-between border-b border-border bg-background px-5 py-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                <Zap className="h-3 w-3" />
                {responseMetadata.provider}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{responseMetadata.model}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{responseMetadata.latencyMs}ms</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {responseMetadata.tokens.input.toLocaleString()} in ·{' '}
                {responseMetadata.tokens.output.toLocaleString()} out
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyResponse}
                className="h-7 px-2 text-xs"
              >
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadMarkdown}
                className="h-7 px-2 text-xs"
              >
                <Download className="mr-1 h-3 w-3" />
                .md
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Regen
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Toggle */}
        {hasResponse && (
          <div className="flex border-b border-border bg-background lg:hidden">
            <button
              onClick={() => setMobileView('config')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                mobileView === 'config'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground',
              )}
            >
              <PanelLeftClose className="mr-1 inline h-3 w-3" />
              Config
            </button>
            <button
              onClick={() => setMobileView('response')}
              className={cn(
                'flex-1 py-2 text-xs font-medium transition-colors',
                mobileView === 'response'
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground',
              )}
            >
              <PanelRightClose className="mr-1 inline h-3 w-3" />
              Response
            </button>
          </div>
        )}

        {/* Response Content */}
        <div ref={responseRef} className="flex-1 overflow-y-auto">
          {isStreaming && !responseContent && (
            <div className="flex h-full items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Sparkles className="h-8 w-8 animate-pulse" />
                <p className="text-sm">Waiting for response...</p>
              </div>
            </div>
          )}

          {hasResponse && (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(responseContent),
                }}
              />
              {isStreaming && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/70" />
              )}
            </div>
          )}

          {!hasResponse && !isStreaming && (
            <div className="flex h-full flex-col items-center justify-center p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-2xl bg-muted p-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No response yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Write a prompt and click Generate to see the AI response here.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2.5 py-1">
                    {provider} / {model}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1">Ctrl+Enter to send</span>
                </div>
              </div>
            </div>
          )}

          {stream.error && (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Stream Error</p>
                    <p className="mt-1 text-sm text-muted-foreground">{stream.error.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Session History */}
          {currentSession && currentSession.messages.length > 0 && !hasResponse && (
            <div className="mx-auto max-w-3xl px-6 py-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" />
                Conversation History
              </div>
              <div className="space-y-3">
                {currentSession.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3 rounded-lg p-3',
                      message.role === 'user' ? 'bg-muted/50' : 'bg-background',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {message.role === 'user' ? (
                        <User className="h-3 w-3" />
                      ) : (
                        <Bot className="h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                      </p>
                      <div
                        className="mt-1 prose prose-xs max-w-none text-sm"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(message.content.slice(0, 300)),
                        }}
                      />
                      {message.content.length > 300 && (
                        <p className="mt-1 text-xs text-muted-foreground">...</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
