import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { Send, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { useMonaco } from '@monaco-editor/react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Button } from '@/components/ui/button';
import { useCodeReview, type CodeReviewResponse } from '@/hooks/use-code-review';
import { useFixMode } from '@/hooks/use-fix-mode';
import { FixPanel } from '@/components/ai/fix-mode';
import { useTheme } from '@/hooks/use-theme';
import { StreamingResponse } from '@/components/ai/streaming-response';
import {
  LANGUAGES,
  REVIEW_TYPES,
  REVIEW_DEPTHS,
  MONACO_LANG_MAP,
  PROVIDERS,
} from '@/lib/constants';
import {
  extractScore,
  getScoreColor,
  getScoreLabel,
  getScoreBg,
  renderMarkdown,
  extractSections,
} from '@/lib/markdown';
import { useCopyToClipboard } from '@/lib/clipboard';
import { useDownloadFile } from '@/lib/download';
import { getErrorMessage } from '@/lib/error-messages';
import { Select } from '@/components/ui/select';
import {
  EditorToolbar,
  ReviewHeader,
  ReviewEmptyState,
  ReviewCard,
  LoadingSteps,
} from '@/components/code-review';

const Editor = lazy(() => import('@monaco-editor/react'));

const STORAGE_KEY = 'devpilot_code_review';

interface PersistedState {
  language: string;
  reviewType: string;
  reviewDepth: string;
  provider: string;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw)
      : {
          language: 'typescript',
          reviewType: 'Standard',
          reviewDepth: 'Standard',
          provider: 'gemini',
        };
  } catch {
    return {
      language: 'typescript',
      reviewType: 'Standard',
      reviewDepth: 'Standard',
      provider: 'gemini',
    };
  }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function getScoreAccent(score: number): string {
  if (score >= 9) return '#22c55e';
  if (score >= 7) return '#3b82f6';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

export function CodeReviewPage() {
  const saved = loadState();
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const [language, setLanguage] = useState(saved.language);
  const [reviewType, setReviewType] = useState(saved.reviewType);
  const [reviewDepth, setReviewDepth] = useState(saved.reviewDepth);
  const [code, setCode] = useState('');
  const [context, setContext] = useState('');
  const [provider, setProvider] = useState(saved.provider);

  const [result, setResult] = useState<CodeReviewResponse | null>(null);
  const [useStreaming] = useState(true);
  const [showFixMode, setShowFixMode] = useState(false);
  const [wordWrap, setWordWrap] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const review = useCodeReview();
  const fixMode = useFixMode();
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;

    const m = monaco as any;

    if (m.languages.typescript?.typescriptDefaults) {
      m.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: m.languages.typescript.ScriptTarget.ESNext,
        module: m.languages.typescript.ModuleKind.ESNext,
        moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: m.languages.typescript.JsxEmit.React,
        allowJs: true,
        allowNonTsExtensions: true,
        noEmit: true,
        esModuleInterop: true,
      });
    }

    if (m.languages.javascriptDefaults) {
      m.languages.javascriptDefaults.setCompilerOptions({
        target: m.languages.typescript.ScriptTarget.ESNext,
        module: m.languages.typescript.ModuleKind.ESNext,
        moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: m.languages.typescript.JsxEmit.React,
        allowJs: true,
        allowNonTsExtensions: true,
        noEmit: true,
        esModuleInterop: true,
      });
    }
  }, [monaco]);

  const score = useMemo(() => (result ? extractScore(result.response) : null), [result]);
  const sections = useMemo(() => (result ? extractSections(result.response) : []), [result]);

  const persist = useCallback(
    (overrides: Partial<PersistedState> = {}) => {
      saveState({ language, reviewType, reviewDepth, provider, ...overrides });
    },
    [language, reviewType, reviewDepth, provider],
  );

  const handleLanguageChange = useCallback(
    (val: string) => {
      setLanguage(val);
      persist({ language: val });
    },
    [persist],
  );
  const handleReviewTypeChange = useCallback(
    (val: string) => {
      setReviewType(val);
      persist({ reviewType: val });
    },
    [persist],
  );
  const handleReviewDepthChange = useCallback(
    (val: string) => {
      setReviewDepth(val);
      persist({ reviewDepth: val });
    },
    [persist],
  );
  const handleProviderChange = useCallback(
    (val: string) => {
      setProvider(val);
      persist({ provider: val });
    },
    [persist],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || review.isPending) return;
    setResult(null);
    setShowFixMode(false);
    fixMode.reset();
    review.mutate(
      {
        language,
        reviewType,
        reviewDepth,
        code,
        context: context || undefined,
        provider,
        stream: useStreaming,
      },
      { onSuccess: (data) => setResult(data) },
    );
  }

  function handleRetry() {
    if (!code.trim() || review.isPending) return;
    setResult(null);
    review.mutate(
      {
        language,
        reviewType,
        reviewDepth,
        code,
        context: context || undefined,
        provider,
        stream: useStreaming,
      },
      { onSuccess: (data) => setResult(data) },
    );
  }

  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const { downloadMarkdown } = useDownloadFile();

  function handleCopyReport() {
    if (!result) return;
    copyToClipboard(result.response);
  }

  function handleDownloadMarkdown() {
    if (!result) return;
    downloadMarkdown(result.response, 'code-review');
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setCode(text);
    } catch {
      /* clipboard permission denied */
    }
  }

  function handleUpload() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') setCode(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClear() {
    setCode('');
    setResult(null);
    setShowFixMode(false);
    fixMode.reset();
  }

  function handleFormat() {
    const editor = editorRef.current;
    if (editor) {
      editor.getAction('editor.action.formatDocument')?.run();
    }
  }

  function handleEditorDidMount(editor: any) {
    editorRef.current = editor;
  }

  const providerLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.cpp,.c,.cs,.rb,.php,.swift,.kt,.sql,.sh,.txt,.md,.json,.yaml,.yml,.html,.css,.vue,.svelte"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Code Review</h1>
          <span className="text-xs text-muted-foreground">
            {code.split(/\s+/).filter(Boolean).length} words · {code.split('\n').length} lines
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Compact config toolbar */}
          <div className="hidden md:flex items-center gap-1.5">
            <Select
              options={LANGUAGES}
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="h-8 w-auto min-w-[100px] px-2 py-1 pr-7 text-xs"
            />
            <Select
              options={REVIEW_TYPES}
              value={reviewType}
              onChange={(e) => handleReviewTypeChange(e.target.value)}
              className="h-8 w-auto min-w-[110px] px-2 py-1 pr-7 text-xs"
            />
            <Select
              options={REVIEW_DEPTHS}
              value={reviewDepth}
              onChange={(e) => handleReviewDepthChange(e.target.value)}
              className="h-8 w-auto min-w-[90px] px-2 py-1 pr-7 text-xs"
            />
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          <Select
            options={PROVIDERS}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="h-8 w-auto min-w-[100px] px-2 py-1 pr-7 text-xs font-medium"
          />
        </div>
      </div>

      {/* Mobile config (stacked on small screens) */}
      <div className="md:hidden border-b border-border px-5 py-2.5 space-y-2 shrink-0">
        <div className="grid grid-cols-3 gap-2">
          <Select
            options={LANGUAGES}
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="h-8 text-xs"
          />
          <Select
            options={REVIEW_TYPES}
            value={reviewType}
            onChange={(e) => handleReviewTypeChange(e.target.value)}
            className="h-8 text-xs"
          />
          <Select
            options={REVIEW_DEPTHS}
            value={reviewDepth}
            onChange={(e) => handleReviewDepthChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Main Content - Resizable Panels */}
      <Group orientation="horizontal" className="flex-1 min-h-0">
        {/* Left Panel - Editor */}
        <Panel defaultSize={40} minSize={25} maxSize={65}>
          <div className="flex h-full flex-col border-r border-border">
            <EditorToolbar
              onPaste={handlePaste}
              onUpload={handleUpload}
              onClear={handleClear}
              onFormat={handleFormat}
              wordWrap={wordWrap}
              onToggleWordWrap={() => setWordWrap(!wordWrap)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              hasCode={code.length > 0}
            />

            <div
              className={`flex-1 min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}
            >
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading editor...
                  </div>
                }
              >
                <Editor
                  height="100%"
                  language={MONACO_LANG_MAP[language] || 'plaintext'}
                  theme={monacoTheme}
                  value={code}
                  onChange={(val) => setCode(val ?? '')}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    wordWrap: wordWrap ? 'on' : 'off',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    padding: { top: 12, bottom: 12 },
                    renderLineHighlight: 'gutter',
                    bracketPairColorization: { enabled: true },
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                  }}
                />
              </Suspense>
            </div>

            {/* Bottom config + submit (collapsed context input) */}
            <div className="shrink-0 border-t border-border px-4 py-2.5 space-y-2">
              <input
                type="text"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Add context (optional) — e.g., React component with performance issues..."
                className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!code.trim() || review.isPending}
                className="w-full h-9 text-sm font-semibold"
              >
                {review.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Review Code
                  </>
                )}
              </Button>
            </div>
          </div>
        </Panel>

        <Separator className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

        {/* Right Panel - Results */}
        <Panel defaultSize={60} minSize={35} maxSize={75}>
          <div className="flex h-full flex-col overflow-hidden">
            {/* Review Header (when result exists) */}
            {result && !review.isPending && (
              <ReviewHeader
                result={result}
                providerLabel={providerLabel}
                score={score}
                copied={copied}
                showFixMode={showFixMode}
                isFixLoading={fixMode.isLoading}
                onCopy={handleCopyReport}
                onDownload={handleDownloadMarkdown}
                onRetry={handleRetry}
                onToggleFix={() => {
                  const next = !showFixMode;
                  setShowFixMode(next);
                  if (next && !fixMode.result && code.trim()) {
                    fixMode.generateFixes({
                      code,
                      language,
                      reviewContext: result.response,
                      provider,
                    });
                  }
                }}
              />
            )}

            {/* Review Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Error */}
              {review.isError &&
                (() => {
                  const errorInfo = getErrorMessage(review.error?.error);
                  return (
                    <div className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-destructive">{errorInfo.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{errorInfo.message}</p>
                          {errorInfo.suggestion && (
                            <p className="mt-2 text-xs text-muted-foreground/80">
                              {errorInfo.suggestion}
                            </p>
                          )}
                        </div>
                        {errorInfo.retryable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRetry}
                            className="shrink-0"
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Completed Review - Collapsible Cards */}
              {result && !review.isPending && (
                <div className="p-4 space-y-2">
                  {/* Score Banner */}
                  {score !== null && (
                    <div className={`rounded-lg border p-4 ${getScoreBg(score)}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Overall Score</p>
                          <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}/10</p>
                        </div>
                        <p className={`text-sm font-medium ${getScoreColor(score)}`}>
                          {getScoreLabel(score)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Section Cards */}
                  {sections.map((section, i) => (
                    <ReviewCard
                      key={i}
                      title={section.title}
                      defaultOpen={i < 3}
                      accent={getScoreAccent(score ?? 5)}
                      copyContent={`# ${section.title}\n\n${section.content}`}
                    >
                      <div
                        className="prose prose-sm dark:prose-invert text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(`# ${section.title}\n\n${section.content}`),
                        }}
                      />
                    </ReviewCard>
                  ))}
                </div>
              )}

              {/* Streaming Content */}
              {review.isPending && useStreaming && review.content && (
                <div className="p-4">
                  <div className="rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2">
                      <span className="text-sm font-medium">AI Review</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        Streaming
                      </span>
                    </div>
                    <StreamingResponse
                      content={review.content}
                      isStreaming={review.isPending}
                      className="p-4 min-h-[200px] max-h-[600px] text-sm leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Loading (non-streaming) */}
              {review.isPending && (!useStreaming || !review.content) && <LoadingSteps />}

              {/* Fix Mode Panel */}
              {result && !review.isPending && showFixMode && (
                <div className="px-4 pb-4">
                  <ReviewCard title="AI Fix Mode" defaultOpen={true} accent="#10b981">
                    <FixPanel
                      result={fixMode.result}
                      isLoading={fixMode.isLoading}
                      error={fixMode.error}
                      provider={fixMode.provider}
                      model={fixMode.model}
                      latencyMs={fixMode.latencyMs}
                      onRegenerate={() =>
                        fixMode.generateFixes({
                          code,
                          language,
                          reviewContext: result.response,
                          provider,
                        })
                      }
                    />
                  </ReviewCard>
                </div>
              )}

              {/* Empty State */}
              {!result && !review.isError && !review.isPending && <ReviewEmptyState />}
            </div>
          </div>
        </Panel>
      </Group>
    </div>
  );
}
