import { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCodeReview, type CodeReviewResponse } from '@/hooks/use-code-review';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, REVIEW_TYPES, MONACO_LANG_MAP } from './form-config';

const STORAGE_KEY = 'devpilot_code_review';

interface PersistedState {
  language: string;
  reviewType: string;
  provider: string;
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw)
      : { language: 'typescript', reviewType: 'Standard', provider: 'gemini' };
  } catch {
    return { language: 'typescript', reviewType: 'Standard', provider: 'gemini' };
  }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function renderMarkdown(text: string): string {
  let html = text;

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="relative my-3 rounded-md border border-input bg-muted/50"><div class="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-input"><span>${lang || 'code'}</span><button onclick="navigator.clipboard.writeText(this.closest('.relative').querySelector('code').textContent)" class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"><svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button></div><pre class="overflow-x-auto p-4 font-mono text-sm"><code>${escaped}</code></pre></div>`;
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

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function CodeReviewPage() {
  const saved = loadState();
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const [language, setLanguage] = useState(saved.language);
  const [reviewType, setReviewType] = useState(saved.reviewType);
  const [code, setCode] = useState('');
  const [context, setContext] = useState('');
  const [provider, setProvider] = useState(saved.provider);

  const [result, setResult] = useState<CodeReviewResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const review = useCodeReview();

  const handleLanguageChange = useCallback(
    (val: string) => {
      setLanguage(val);
      saveState({ language: val, reviewType, provider });
    },
    [reviewType, provider],
  );

  const handleReviewTypeChange = useCallback(
    (val: string) => {
      setReviewType(val);
      saveState({ language, reviewType: val, provider });
    },
    [language, provider],
  );

  const handleProviderChange = useCallback(
    (val: string) => {
      setProvider(val);
      saveState({ language, reviewType, provider: val });
    },
    [language, reviewType],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || review.isPending) return;

    review.mutate(
      { language, reviewType, code, context: context || undefined, provider },
      { onSuccess: (data) => setResult(data) },
    );
  }

  function handleRetry() {
    if (!code.trim() || review.isPending) return;
    review.mutate(
      { language, reviewType, code, context: context || undefined, provider },
      { onSuccess: (data) => setResult(data) },
    );
  }

  function handleCopyReport() {
    if (!result) return;
    const metadata = [
      `Provider: ${result.provider}`,
      `Model: ${result.model}`,
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

  function handleDownloadMarkdown() {
    if (!result) return;
    const blob = new Blob([result.response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-${language}-${Date.now()}.md`;
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
              Paste your code and get a structured AI-powered review with actionable feedback.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Language & Review Type */}
            <div className="grid grid-cols-2 gap-4">
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
                  >
                    {REVIEW_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>
                        {rt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {REVIEW_TYPES.find((rt) => rt.value === reviewType)?.description}
                </p>
              </div>
            </div>

            {/* Code Editor */}
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-sm font-medium">
                Code <span className="text-destructive">*</span>
              </label>
              <div className="overflow-hidden rounded-md border border-input">
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
                rows={3}
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
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
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
            <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-4">
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
          {result && (
            <div className="space-y-3">
              {/* Metrics */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {result.provider} / {result.model}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {result.latencyMs}ms
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {result.usage.input.toLocaleString()} in / {result.usage.output.toLocaleString()}{' '}
                  out
                </span>
              </div>

              {/* Report */}
              <div className="rounded-md border border-input bg-muted/20">
                <div className="flex items-center justify-between border-b border-input px-4 py-2">
                  <span className="text-sm font-medium">Review Report</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopyReport}
                      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .md
                    </button>
                  </div>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none p-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(result.response) }}
                />
              </div>

              {/* Token Usage */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-input p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">Input</p>
                  <p className="text-sm font-semibold">{result.usage.input.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-input p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">Output</p>
                  <p className="text-sm font-semibold">{result.usage.output.toLocaleString()}</p>
                </div>
                <div className="rounded-md border border-input p-2.5 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold">{result.usage.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {review.isPending && (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Reviewing your code...</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This may take a moment for large codebases
                </p>
              </div>
            </div>
          )}

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
