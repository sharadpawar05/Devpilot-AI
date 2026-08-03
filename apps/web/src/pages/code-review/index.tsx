import { useState, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  Code,
  ChevronDown,
  Copy,
  Check,
  Download,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCodeReview, type CodeReviewResponse } from '@/hooks/use-code-review';
import { useFixMode } from '@/hooks/use-fix-mode';
import { FixPanel } from '@/components/ai/fix-mode';
import { useTheme } from '@/hooks/use-theme';
import { StreamingResponse } from '@/components/ai/streaming-response';
import { LANGUAGES, REVIEW_TYPES, REVIEW_DEPTHS, MONACO_LANG_MAP } from './form-config';

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

const PROGRESS_MESSAGES = [
  'Analyzing code structure...',
  'Checking correctness...',
  'Reviewing performance...',
  'Scanning for security issues...',
  'Generating recommendations...',
];

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini Flash' },
  { value: 'openai', label: 'GPT-4o' },
  { value: 'anthropic', label: 'Claude 3.5' },
  { value: 'openrouter', label: 'OpenRouter' },
];

function extractScore(text: string): number | null {
  const patterns = [
    /\*\*(\d+\.?\d*)\s*\/\s*10\*\*/,
    /(\d+\.?\d*)\s*\/\s*10/,
    /Score:\s*(\d+\.?\d*)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const score = parseFloat(match[1]);
      if (score >= 0 && score <= 10) return score;
    }
  }
  return null;
}

function getScoreColor(score: number): string {
  if (score >= 9) return 'text-green-500';
  if (score >= 7) return 'text-blue-500';
  if (score >= 5) return 'text-amber-500';
  return 'text-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Needs Improvement';
  return 'Poor';
}

function getScoreBg(score: number): string {
  if (score >= 9) return 'bg-green-500/10 border-green-500/30';
  if (score >= 7) return 'bg-blue-500/10 border-blue-500/30';
  if (score >= 5) return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function renderMarkdown(text: string): string {
  let html = text;

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const id = `cb-${Math.random().toString(36).slice(2, 8)}`;
    return `<div class="relative my-3 rounded-md border border-input bg-muted/50"><div class="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-input"><span>${lang || 'code'}</span><button onclick="(async()=>{const t=this.closest('.relative').querySelector('code').textContent;await navigator.clipboard.writeText(t);const s=this.querySelector('span');s.textContent='Copied!';setTimeout(()=>s.textContent='Copy',2000)})()" class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors" aria-label="Copy code block"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span></button></div><pre class="overflow-x-auto p-4 font-mono text-sm"><code id="${id}">${escaped}</code></pre></div>`;
  });

  html = html.replace(
    /`([^`]+)`/g,
    '<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">$1</code>',
  );

  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-4 mb-2 text-base font-semibold">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-5 mb-2 text-lg font-bold">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-6 mb-3 text-xl font-bold">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^---$/gm, '<hr class="my-4 border-input" />');

  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(
    /(<li[^>]*>.*<\/li>\n?)+/g,
    (match) => `<ul class="my-2 space-y-1">${match}</ul>`,
  );

  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  html = html.replace(/^(?!<[a-z/])((?!^\s*$).+)$/gm, '<p class="mb-2">$1</p>');

  return html;
}

function extractSections(text: string): { title: string; content: string }[] {
  const sections: { title: string; content: string }[] = [];
  const lines = text.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const match = h1Match || h2Match;

    if (match) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
      }
      currentTitle = match[1].replace(/\*\*/g, '');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join('\n').trim() });
  }

  return sections;
}

function LoadingProgress() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % PROGRESS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{PROGRESS_MESSAGES[messageIndex]}</p>
        <div className="mt-3 flex justify-center gap-1">
          {PROGRESS_MESSAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === messageIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
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
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [useStreaming] = useState(true);
  const [showFixMode, setShowFixMode] = useState(false);

  const review = useCodeReview();
  const fixMode = useFixMode();

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

  function handleCopyReport() {
    if (!result) return;
    navigator.clipboard.writeText(result.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopySection(index: number) {
    const section = sections[index];
    if (!section) return;
    navigator.clipboard.writeText(`# ${section.title}\n\n${section.content}`);
    setCopiedSection(index);
    setTimeout(() => setCopiedSection(null), 2000);
  }

  function handleDownloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result.response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const providerLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h1 className="text-base font-semibold">Code Review</h1>
        <div className="relative">
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="appearance-none rounded-md border border-input bg-background px-3 py-1.5 pr-8 text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Left Panel - Editor + Config */}
        <div className="flex w-full flex-col border-r border-border lg:w-[42%]">
          {/* Monaco Editor */}
          <div className="min-h-0 flex-1 border-b border-border">
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
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
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

          {/* Bottom Config Bar */}
          <div className="shrink-0 border-t border-border bg-background px-5 py-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Dropdowns Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Language</label>
                  <div className="relative">
                    <select
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value)}
                      className={`${selectClass} appearance-none pr-8`}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Review Type
                  </label>
                  <div className="relative">
                    <select
                      value={reviewType}
                      onChange={(e) => handleReviewTypeChange(e.target.value)}
                      className={`${selectClass} appearance-none pr-8`}
                    >
                      {REVIEW_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>
                          {rt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Depth</label>
                  <div className="relative">
                    <select
                      value={reviewDepth}
                      onChange={(e) => handleReviewDepthChange(e.target.value)}
                      className={`${selectClass} appearance-none pr-8`}
                    >
                      {REVIEW_DEPTHS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Context */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Context <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., React component with performance issues..."
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              {/* Review Button */}
              <Button type="submit" disabled={!code.trim() || review.isPending} className="w-full">
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
            </form>
          </div>
        </div>

        {/* Right Panel - AI Review */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Review Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Error */}
            {review.isError && (
              <div className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Review Failed</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {review.error?.error?.message ?? 'An unexpected error occurred'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRetry}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {/* Completed Review */}
            {result && !review.isPending && (
              <div className="p-6">
                {/* Score Banner */}
                {score !== null && (
                  <div className={`mb-4 rounded-lg border p-4 ${getScoreBg(score)}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Overall Score</p>
                        <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}/10</p>
                      </div>
                      <p className={`text-sm font-medium ${getScoreColor(score)}`}>
                        {getScoreLabel(score)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Report Sections */}
                <div className="space-y-1">
                  {sections.map((section, i) => (
                    <div
                      key={i}
                      className="group relative rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between px-2 py-2">
                        <div
                          className="prose prose-sm dark:prose-invert flex-1 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(`# ${section.title}\n\n${section.content}`),
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCopySection(i)}
                          className="ml-2 mt-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                          aria-label={`Copy ${section.title}`}
                        >
                          {copiedSection === i ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streaming Content */}
            {review.isPending && useStreaming && review.content && (
              <div className="p-6">
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
            {review.isPending && (!useStreaming || !review.content) && (
              <div className="p-6">
                <LoadingProgress />
              </div>
            )}

            {/* Fix Mode Panel */}
            {result && !review.isPending && showFixMode && (
              <div className="border-t border-border px-6 py-4">
                <div className="rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                    <Wrench className="h-4 w-4" />
                    <span className="text-sm font-medium">AI Fix Mode</span>
                  </div>
                  <div className="p-4">
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
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!result && !review.isError && !review.isPending && (
              <div className="flex h-full items-center justify-center p-6">
                <div className="text-center">
                  <Code className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    Paste code on the left and click &quot;Review Code&quot;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer - Metadata + Actions */}
          {result && !review.isPending && (
            <div className="shrink-0 border-t border-border bg-background px-5 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{providerLabel}</span>
                  <span>{(result.latencyMs / 1000).toFixed(1)} sec</span>
                  <span>{result.usage.total.toLocaleString()} tokens</span>
                  {score !== null && (
                    <span className={`font-medium ${getScoreColor(score)}`}>Score: {score}/10</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyReport}
                    className="h-7 px-2 text-xs"
                  >
                    {copied ? (
                      <Check className="mr-1 h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    {copied ? 'Copied' : 'Copy'}
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
                    onClick={() => {
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
                    className={`h-7 px-2 text-xs ${showFixMode ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Wrench className="mr-1 h-3 w-3" />
                    Fix
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
