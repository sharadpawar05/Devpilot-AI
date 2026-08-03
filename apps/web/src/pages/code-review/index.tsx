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
  Zap,
  Clock,
  Hash,
  RotateCcw,
  Layers,
  BarChart3,
  Radio,
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
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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

  // Code blocks with copy button
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

function MetricsCards({
  result,
  score,
  reviewDepth,
}: {
  result: CodeReviewResponse;
  score: number | null;
  reviewDepth: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {score !== null && (
        <div className={`rounded-md border p-3 text-center ${getScoreBg(score)}`}>
          <p className="text-xs text-muted-foreground">Score</p>
          <p className={`text-xl font-bold ${getScoreColor(score)}`}>{score}/10</p>
          <p className={`text-xs font-medium ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        </div>
      )}
      <div className="rounded-md border border-input p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Provider</p>
        </div>
        <p className="mt-1 text-sm font-semibold">{result.provider}</p>
        <p className="text-xs text-muted-foreground">{result.model}</p>
      </div>
      <div className="rounded-md border border-input p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Latency</p>
        </div>
        <p className="mt-1 text-sm font-semibold">{(result.latencyMs / 1000).toFixed(1)}s</p>
      </div>
      <div className="rounded-md border border-input p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <BarChart3 className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Tokens</p>
        </div>
        <p className="mt-1 text-sm font-semibold">{result.usage.total.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">
          {result.usage.input.toLocaleString()} in / {result.usage.output.toLocaleString()} out
        </p>
      </div>
      <div className="rounded-md border border-input p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Depth</p>
        </div>
        <p className="mt-1 text-sm font-semibold">{reviewDepth}</p>
      </div>
      <div className="rounded-md border border-input p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <Hash className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Timestamp</p>
        </div>
        <p className="mt-1 text-sm font-semibold">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
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
  const [useStreaming, setUseStreaming] = useState(true);
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
    const metadata = [
      `Provider: ${result.provider}`,
      `Model: ${result.model}`,
      `Review Depth: ${result.reviewDepth}`,
      `Latency: ${result.latencyMs}ms`,
      `Tokens: ${result.usage.input} in / ${result.usage.output} out / ${result.usage.total} total`,
      `Timestamp: ${new Date().toISOString()}`,
      '',
      '---',
      '',
    ].join('\n');
    navigator.clipboard.writeText(metadata + result.response);
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
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([result.response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setCode('');
    setContext('');
    setResult(null);
  }

  const isValid = code.trim().length > 0;

  return (
    <div className="flex h-full">
      {/* Left Panel - Configuration */}
      <div className="flex flex-1 flex-col overflow-y-auto border-r border-input">
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Code Review</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste your code and get a structured AI-powered review.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            aria-label="Code review configuration"
          >
            {/* Language, Review Type, Review Depth */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="language" className="text-sm font-medium">
                  Language
                </label>
                <div className="relative">
                  <select
                    id="language"
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    className={`${selectClass} appearance-none pr-10`}
                    aria-label="Programming language"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reviewType" className="text-sm font-medium">
                  Review Type
                </label>
                <div className="relative">
                  <select
                    id="reviewType"
                    value={reviewType}
                    onChange={(e) => handleReviewTypeChange(e.target.value)}
                    className={`${selectClass} appearance-none pr-10`}
                    aria-label="Review type"
                  >
                    {REVIEW_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reviewDepth" className="text-sm font-medium">
                  Depth
                </label>
                <div className="relative">
                  <select
                    id="reviewDepth"
                    value={reviewDepth}
                    onChange={(e) => handleReviewDepthChange(e.target.value)}
                    className={`${selectClass} appearance-none pr-10`}
                    aria-label="Review depth"
                  >
                    {REVIEW_DEPTHS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {REVIEW_DEPTHS.find((d) => d.value === reviewDepth)?.description}
                </p>
              </div>
            </div>

            {/* Code Editor */}
            <div className="space-y-1.5">
              <label htmlFor="code-editor" className="text-sm font-medium">
                Code <span className="text-destructive">*</span>
              </label>
              <div className="overflow-hidden rounded-md border border-input" id="code-editor">
                <Suspense
                  fallback={
                    <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                      Loading editor...
                    </div>
                  }
                >
                  <Editor
                    height="350px"
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
              {!code.trim() && review.isError && (
                <p className="text-xs text-destructive">Please paste your code.</p>
              )}
            </div>

            {/* Context */}
            <div className="space-y-1.5">
              <label htmlFor="context" className="text-sm font-medium">
                Context <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="e.g., This is a React component causing performance issues..."
                rows={2}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Provider */}
            <div className="space-y-1.5">
              <label htmlFor="provider" className="text-sm font-medium">
                Provider
              </label>
              <div className="relative">
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className={`${selectClass} appearance-none pr-10`}
                  aria-label="AI provider"
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {/* Streaming Toggle */}
            <div className="flex items-center justify-between rounded-md border border-input p-3">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Stream Response</p>
                  <p className="text-xs text-muted-foreground">Show tokens as they are generated</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={useStreaming}
                onClick={() => setUseStreaming(!useStreaming)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  useStreaming ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    useStreaming ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button type="submit" disabled={!isValid || review.isPending} className="flex-1">
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
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={review.isPending}
                aria-label="Reset form"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - AI Review Report */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          {/* Error */}
          {review.isError && (
            <div
              className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4"
              role="alert"
            >
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

          {/* Response */}
          {result && !review.isPending && (
            <div className="space-y-4">
              {/* Metrics Dashboard */}
              <MetricsCards result={result} score={score} reviewDepth={reviewDepth} />

              {/* Report */}
              <div className="rounded-md border border-input bg-muted/20">
                <div className="flex items-center justify-between border-b border-input px-4 py-2">
                  <span className="text-sm font-medium">Review Report</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showFixMode;
                        setShowFixMode(next);
                        if (next && !fixMode.result && code.trim()) {
                          fixMode.generateFixes({
                            code,
                            language,
                            reviewContext: result?.response,
                            provider,
                          });
                        }
                      }}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        showFixMode
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                      aria-label="Toggle fix mode"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Fix Issues
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      aria-label="Copy entire report"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied!' : 'Copy Report'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                      aria-label="Download as Markdown"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .md
                    </button>
                  </div>
                </div>

                {/* Sections with individual copy */}
                <div className="divide-y divide-input">
                  {sections.map((section, i) => (
                    <div key={i} className="group relative">
                      <div className="flex items-center justify-between px-4 py-1.5">
                        <div
                          className="prose prose-sm dark:prose-invert flex-1 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: renderMarkdown(`# ${section.title}\n\n${section.content}`),
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCopySection(i)}
                          className="ml-2 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
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
            </div>
          )}

          {/* Fix Mode Panel */}
          {result && !review.isPending && showFixMode && (
            <div className="space-y-4">
              <div className="rounded-md border border-input bg-muted/20">
                <div className="flex items-center justify-between border-b border-input px-4 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Wrench className="h-4 w-4" />
                    AI Fix Mode
                  </span>
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

          {/* Streaming content */}
          {review.isPending && useStreaming && review.content && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Streaming response...</span>
              </div>
              <div className="rounded-md border border-input bg-muted/20">
                <div className="flex items-center justify-between border-b border-input px-4 py-2">
                  <span className="text-sm font-medium">Review Report</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live
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
          {review.isPending && (!useStreaming || !review.content) && <LoadingProgress />}

          {/* Empty state */}
          {!result && !review.isError && !review.isPending && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Code className="mx-auto mb-2 h-6 w-6" />
                <p className="text-sm">
                  Paste your code on the left and click &quot;Review Code&quot;
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
