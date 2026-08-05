import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  History,
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  Settings2,
  Code,
  Wand2,
  Bug,
  RefreshCw,
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
import { useStreamingAbort, useCopyResponse } from '@/hooks/use-keyboard-shortcuts';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useAuth } from '@/auth';
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer';
import { cn } from '@/lib/utils';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { PageHeader } from '@/components/workspace/PageHeader';
import { StickySubmit } from '@/components/workspace/StickyFooter';
import { EmptyState } from '@/components/shared/EmptyState';
import { PlaygroundLoadingSteps } from '@/components/shared/LoadingSteps';
import { getProviderOptions, getModelOptions } from '@devpilot/config';
import { getFriendlyError } from '@/lib/ai-errors';
import type { AIHistorySession } from '@devpilot/types';

const PROVIDERS = getProviderOptions();

const MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: getModelOptions('gemini'),
  openai: getModelOptions('openai'),
  anthropic: getModelOptions('anthropic'),
  openrouter: getModelOptions('openrouter'),
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

const PLAYGROUND_FEATURES = [
  { icon: Code, label: 'Code Review' },
  { icon: Wand2, label: 'Refactor' },
  { icon: Bug, label: 'Debug' },
];

export function PlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, updatePreference, addRecentPrompt } = useUserPreferences();
  const { session } = useAuth();
  const token = session?.accessToken;
  const [provider, setProvider] = useState(preferences.defaultProvider);
  const [model, setModel] = useState(preferences.defaultModel);
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [template, setTemplate] = useState('custom');
  const [showVariables, setShowVariables] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [currentSession, setCurrentSession] = useState<AIHistorySession | null>(null);
  const [_isLoadingSession, setIsLoadingSession] = useState(false);

  const responseRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chat = useChat();
  const { getSession } = useChatHistory();
  const stream = useStreamSession();

  const availableModels = MODELS[provider] ?? MODELS.gemini;
  const isStreaming = stream.isStreaming;
  const isGenerating = chat.isPending || isStreaming;

  useStreamingAbort({
    onAbort: stream.stopStream,
    enabled: isStreaming,
  });

  useCopyResponse({
    getContent: () => stream.content || result?.response,
    enabled: !!(stream.content || result?.response),
  });

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
    updatePreference('defaultProvider', newProvider);
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
  }

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!prompt.trim() || isGenerating) return;

      addRecentPrompt(prompt.trim());

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
    try {
      // First try to get from backend API
      const sessions = await import('@/lib/ai-history').then((m) =>
        m.aiHistoryApi.listSessions(token || '', {}, { page: 1, pageSize: 1 }),
      );
      if (sessions.sessions[0]) {
        const session = await getSession(sessions.sessions[0].id);
        if (session) {
          setCurrentSession(session);
          return;
        }
      }
    } catch {
      // Fallback to IndexedDB if backend fails
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
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const hasResponse = !!(stream.content || result?.response);
  const responseContent = stream.content || result?.response || '';

  const leftPanel = (
    <>
      <PageHeader
        title={currentSession ? currentSession.title : 'AI Playground'}
        description={
          currentSession
            ? `Continuing conversation · ${currentSession.messages.length} messages`
            : 'Test the AI Gateway with different providers and models.'
        }
        onBack={currentSession ? handleClearSession : undefined}
        actions={
          currentSession ? (
            <Button variant="ghost" size="sm" onClick={handleClearSession} className="h-7 text-xs">
              New
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="advanced" className="border border-border rounded-lg px-3">
              <AccordionTrigger className="text-xs font-medium py-2.5 hover:no-underline">
                <span className="flex items-center gap-2">
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced Settings
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Provider</label>
                    <div className="relative">
                      <select
                        value={provider}
                        onChange={(e) => handleProviderChange(e.target.value)}
                        className="w-full appearance-none rounded-md border border-input bg-background px-2.5 py-1.5 pr-7 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        {PROVIDERS.map((p: { value: string; label: string }) => (
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

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Temperature</label>
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
    </>
  );

  const rightPanel = (
    <>
      {!hasResponse && !isStreaming && (
        <div className="flex h-full flex-col items-center justify-center p-8">
          <EmptyState
            title="No response yet"
            description="Write a prompt and click Generate to see the AI response here."
            variant="playground"
            features={PLAYGROUND_FEATURES}
            hints={[`${provider} / ${model}`, 'Ctrl+Enter to send']}
          />
        </div>
      )}
      {isStreaming && !responseContent && <PlaygroundLoadingSteps className="flex-1" />}
      {hasResponse && (
        <div ref={responseRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Response</p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    stream.reset();
                    setResult(null);
                  }}
                  className="h-7 text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
            <MarkdownRenderer content={responseContent} />
            {isStreaming && (
              <span className="inline-block h-4 w-0.5 animate-pulse bg-foreground/70" />
            )}
          </div>
        </div>
      )}
      {stream.error && (
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="flex-1">
                {(() => {
                  const friendlyError = getFriendlyError(stream.error);
                  return (
                    <>
                      <p className="text-sm font-medium text-destructive">{friendlyError.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{friendlyError.message}</p>
                      {friendlyError.retryable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => {
                            stream.reset();
                            if (prompt.trim()) {
                              handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                            }
                          }}
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Retry
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
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
                  <div className="mt-1">
                    <MarkdownRenderer content={message.content.slice(0, 300)} />
                  </div>
                  {message.content.length > 300 && (
                    <p className="mt-1 text-xs text-muted-foreground">...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <WorkspaceLayout
      left={leftPanel}
      right={rightPanel}
      defaultLeftSize={38}
      minLeftSize={25}
      maxLeftSize={60}
      storageKey="devpilot_playground_layout"
      rightFooter={
        <StickySubmit
          label={currentSession ? 'Continue' : 'Generate'}
          loadingLabel={isStreaming ? 'Streaming...' : 'Generating...'}
          isLoading={isGenerating}
          disabled={!prompt.trim()}
          onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
          error={chat.isError ? getFriendlyError(chat.error).message : undefined}
        />
      }
    />
  );
}
