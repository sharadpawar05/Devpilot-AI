import { useState, useEffect, useCallback, useMemo, Suspense, lazy, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Github,
  Unlink,
  ChevronDown,
  Send,
  Loader2,
  Check,
  Copy,
  Download,
  GitPullRequest,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useGitHub,
  type GitHubRepo,
  type GitHubPull,
  type GitHubFile,
  type GitHubReviewResponse,
} from '@/hooks/use-github';
import { useTheme } from '@/hooks/use-theme';
import {
  renderMarkdown,
  extractSections,
  extractScore,
  getScoreColor,
  getScoreLabel,
  getScoreBg,
} from '@/lib/markdown';

const Editor = lazy(() => import('@monaco-editor/react'));

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const REVIEW_TYPES = [
  { value: 'Standard', label: 'Standard' },
  { value: 'Performance', label: 'Performance' },
  { value: 'Security', label: 'Security' },
  { value: 'Maintainability', label: 'Maintainability' },
  { value: 'Architecture', label: 'Architecture' },
] as const;

const REVIEW_DEPTHS = [
  { value: 'Quick', label: 'Quick' },
  { value: 'Standard', label: 'Standard' },
  { value: 'Deep', label: 'Deep' },
] as const;

const PROGRESS_MESSAGES = [
  'Fetching PR diff...',
  'Analyzing changes...',
  'Reviewing code quality...',
  'Checking for issues...',
  'Generating report...',
];

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
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === messageIndex ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function GitHubReviewPage() {
  const gh = useGitHub();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedPR, setSelectedPR] = useState<GitHubPull | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [reviewType, setReviewType] = useState('Standard');
  const [reviewDepth, setReviewDepth] = useState('Standard');
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState<GitHubReviewResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<number | null>(null);
  const [codeView, setCodeView] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  const score = useMemo(() => (result ? extractScore(result.response) : null), [result]);
  const sections = useMemo<{ title: string; content: string }[]>(
    () => (result ? extractSections(result.response) : []),
    [result],
  );

  const callbackProcessed = useRef(false);

  // Restore selected repo from localStorage when repositories load
  useEffect(() => {
    if (gh.selectedRepoName && gh.repositories.length > 0 && !selectedRepo) {
      const stored = gh.repositories.find((r) => r.full_name === gh.selectedRepoName);
      if (stored) {
        setSelectedRepo(stored);
        const [owner, name] = stored.full_name.split('/');
        gh.fetchBranches(owner, name);
        gh.fetchPulls(owner, name);
      }
    }
  }, [gh.selectedRepoName, gh.repositories, selectedRepo, gh.fetchBranches, gh.fetchPulls]);

  // Restore selected PR from localStorage when pulls load
  useEffect(() => {
    if (gh.selectedPRNumber !== null && gh.pulls.length > 0 && !selectedPR) {
      const stored = gh.pulls.find((p) => p.number === gh.selectedPRNumber);
      if (stored) {
        setSelectedPR(stored);
        if (selectedRepo) {
          const [owner, name] = selectedRepo.full_name.split('/');
          gh.fetchFiles(owner, name, stored.number);
        }
      }
    }
  }, [gh.selectedPRNumber, gh.pulls, selectedPR, selectedRepo, gh.fetchFiles]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    if (callbackProcessed.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      callbackProcessed.current = true;
      gh.handleCallback(code, state).then((success) => {
        if (success) {
          const returnUrl = localStorage.getItem('github_oauth_return');
          localStorage.removeItem('github_oauth_return');
          if (returnUrl && returnUrl !== '/github') {
            navigate(returnUrl, { replace: true });
          } else {
            window.history.replaceState({}, '', '/github');
          }
        } else {
          callbackProcessed.current = false;
        }
      });
    }
  }, [gh.handleCallback, navigate]);

  // Event delegation for copy buttons in markdown content
  useEffect(() => {
    const handleCopyClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const copyButton = target.closest('.copy-button');
      if (!copyButton) return;

      const codeId = copyButton.getAttribute('data-copy-target');
      if (!codeId) return;

      const codeElement = document.getElementById(codeId);
      if (!codeElement) return;

      await navigator.clipboard.writeText(codeElement.textContent || '');
      const span = copyButton.querySelector('span');
      if (span) {
        span.textContent = 'Copied!';
        setTimeout(() => {
          span.textContent = 'Copy';
        }, 2000);
      }
    };

    document.addEventListener('click', handleCopyClick);
    return () => document.removeEventListener('click', handleCopyClick);
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    const url = await gh.connect('/github');
    setConnecting(false);
    if (url) window.location.href = url;
  }, [gh]);

  const handleRepoSelect = useCallback(
    (fullName: string) => {
      const repo = gh.repositories.find((r) => r.full_name === fullName) ?? null;
      setSelectedRepo(repo);
      setSelectedPR(null);
      setSelectedFiles(new Set());
      setResult(null);
      gh.selectRepo(fullName || null);
      if (repo) {
        const [owner, name] = fullName.split('/');
        gh.fetchBranches(owner, name);
        gh.fetchPulls(owner, name);
      }
    },
    [gh],
  );

  const handlePRSelect = useCallback(
    (prNumber: number) => {
      const pr = gh.pulls.find((p) => p.number === prNumber) ?? null;
      setSelectedPR(pr);
      setSelectedFiles(new Set());
      setResult(null);
      gh.selectPR(prNumber || null);
      if (pr && selectedRepo) {
        const [owner, name] = selectedRepo.full_name.split('/');
        gh.fetchFiles(owner, name, pr.number);
      }
    },
    [gh, selectedRepo],
  );

  const handleFileToggle = useCallback((filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  const handleSelectAllFiles = useCallback(() => {
    if (selectedFiles.size === gh.files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(gh.files.map((f) => f.filename)));
    }
  }, [gh.files, selectedFiles.size]);

  const handleReview = useCallback(async () => {
    if (!selectedRepo || !selectedPR) return;
    const [owner, name] = selectedRepo.full_name.split('/');
    const filesToReview = selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined;
    const response = await gh.reviewPR({
      owner,
      repo: name,
      pull_number: selectedPR.number,
      files: filesToReview,
      reviewType,
      reviewDepth,
      provider,
    });
    if (response) setResult(response);
  }, [selectedRepo, selectedPR, selectedFiles, reviewType, reviewDepth, provider, gh]);

  const handleCopyReport = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleCopySection = useCallback(
    (index: number) => {
      const section = sections[index];
      if (!section) return;
      navigator.clipboard.writeText(`# ${section.title}\n\n${section.content}`);
      setCopiedSection(index);
      setTimeout(() => setCopiedSection(null), 2000);
    },
    [sections],
  );

  const handleDownload = useCallback(() => {
    if (!result) return;
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([result.response], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pr-review-${date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleViewFile = useCallback((file: GitHubFile) => {
    setCodeView(file.patch || '(binary file)');
  }, []);

  const canReview = selectedRepo && selectedPR && !gh.loading;

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="flex flex-1 flex-col overflow-y-auto border-r border-input">
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">GitHub Review</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect GitHub and review pull requests with AI.
            </p>
          </div>

          {/* GitHub Account Section */}
          <div className="space-y-4">
            <div className="rounded-md border border-input p-4">
              <h3 className="mb-3 text-sm font-medium">GitHub Account</h3>
              {gh.connected && gh.githubUser ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={gh.githubUser.avatar_url}
                          alt={gh.githubUser.login}
                          className="h-10 w-10 rounded-full"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {gh.githubUser.name || gh.githubUser.login}
                        </p>
                        <p className="text-xs text-muted-foreground">@{gh.githubUser.login}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                        Connected
                      </span>
                    </div>
                  </div>
                  {gh.connectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Connected since {new Date(gh.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={gh.disconnect}
                    disabled={gh.disconnecting}
                    className="w-full"
                  >
                    {gh.disconnecting ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="mr-1 h-3 w-3" />
                    )}
                    {gh.disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={handleConnect} disabled={connecting}>
                  {connecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Github className="mr-2 h-4 w-4" />
                  )}
                  {connecting ? 'Connecting...' : 'Connect GitHub'}
                </Button>
              )}
            </div>

            {/* Repository Selector */}
            {gh.connected && (
              <div className="space-y-1.5">
                <label htmlFor="repo" className="text-sm font-medium">
                  Repository
                </label>
                <div className="relative">
                  <select
                    id="repo"
                    value={selectedRepo?.full_name ?? ''}
                    onChange={(e) => handleRepoSelect(e.target.value)}
                    className={`${selectClass} appearance-none pr-10`}
                  >
                    <option value="">Select a repository...</option>
                    {gh.repositories.map((r) => (
                      <option key={r.full_name} value={r.full_name}>
                        {r.full_name} {r.private ? '(private)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* PR Selector */}
            {selectedRepo && (
              <div className="space-y-1.5">
                <label htmlFor="pr" className="text-sm font-medium">
                  Pull Request
                </label>
                <div className="relative">
                  <select
                    id="pr"
                    value={selectedPR?.number ?? ''}
                    onChange={(e) => handlePRSelect(Number(e.target.value))}
                    className={`${selectClass} appearance-none pr-10`}
                  >
                    <option value="">Select a PR...</option>
                    {gh.pulls.map((p) => (
                      <option key={p.number} value={p.number}>
                        #{p.number} - {p.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}

            {/* PR Info */}
            {selectedPR && (
              <div className="rounded-md border border-input p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      #{selectedPR.number} - {selectedPR.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {selectedPR.user} | +{selectedPR.additions} -{selectedPR.deletions} |{' '}
                      {selectedPR.changed_files} files
                    </p>
                  </div>
                  <a
                    href={selectedPR.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Files Changed */}
            {gh.files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Files Changed ({gh.files.length})</label>
                  <button
                    type="button"
                    onClick={handleSelectAllFiles}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {selectedFiles.size === gh.files.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                  {gh.files.map((f) => (
                    <div
                      key={f.filename}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(f.filename)}
                        onChange={() => handleFileToggle(f.filename)}
                        className="h-3.5 w-3.5"
                      />
                      <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate font-mono text-xs">{f.filename}</span>
                      <span className="text-xs text-green-500">+{f.additions}</span>
                      <span className="text-xs text-red-500">-{f.deletions}</span>
                      <button
                        type="button"
                        onClick={() => handleViewFile(f)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <FileCode className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedFiles.size === 0
                    ? 'All files will be reviewed'
                    : `${selectedFiles.size} file(s) selected for review`}
                </p>
              </div>
            )}

            {/* Review Settings */}
            {selectedPR && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="reviewType" className="text-sm font-medium">
                    Type
                  </label>
                  <div className="relative">
                    <select
                      id="reviewType"
                      value={reviewType}
                      onChange={(e) => setReviewType(e.target.value)}
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
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="reviewDepth" className="text-sm font-medium">
                    Depth
                  </label>
                  <div className="relative">
                    <select
                      id="reviewDepth"
                      value={reviewDepth}
                      onChange={(e) => setReviewDepth(e.target.value)}
                      className={`${selectClass} appearance-none pr-10`}
                    >
                      {REVIEW_DEPTHS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="provider" className="text-sm font-medium">
                    Provider
                  </label>
                  <div className="relative">
                    <select
                      id="provider"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className={`${selectClass} appearance-none pr-10`}
                    >
                      <option value="gemini">Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )}

            {/* Code Preview */}
            {codeView && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">File Preview</label>
                  <button
                    type="button"
                    onClick={() => setCodeView('')}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <div className="overflow-hidden rounded-md border border-input">
                  <Suspense
                    fallback={
                      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                        Loading...
                      </div>
                    }
                  >
                    <Editor
                      height="250px"
                      language="diff"
                      theme={monacoTheme}
                      value={codeView}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 12,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Review Button */}
            {selectedPR && (
              <Button onClick={handleReview} disabled={!canReview} className="w-full">
                {gh.loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reviewing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Review PR
                  </>
                )}
              </Button>
            )}

            {/* Error */}
            {gh.error && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {gh.error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          {/* Metrics */}
          {result && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {score !== null && (
                <div className={`rounded-md border p-3 text-center ${getScoreBg(score)}`}>
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className={`text-xl font-bold ${getScoreColor(score)}`}>{score}/10</p>
                  <p className={`text-xs font-medium ${getScoreColor(score)}`}>
                    {getScoreLabel(score)}
                  </p>
                </div>
              )}
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Provider</p>
                <p className="mt-1 text-sm font-semibold">{result.provider}</p>
              </div>
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Latency</p>
                <p className="mt-1 text-sm font-semibold">
                  {(result.latencyMs / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Tokens</p>
                <p className="mt-1 text-sm font-semibold">{result.usage.total.toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Report */}
          {result && (
            <div className="rounded-md border border-input bg-muted/20">
              <div className="flex items-center justify-between border-b border-input px-4 py-2">
                <span className="text-sm font-medium">
                  <GitPullRequest className="mr-1 inline h-4 w-4" />
                  PR #{result.pr.number} Review
                </span>
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
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .md
                  </button>
                </div>
              </div>
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

          {/* Loading */}
          {gh.loading && !result && <LoadingProgress />}

          {/* Empty state */}
          {!result && !gh.error && !gh.loading && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <Github className="mx-auto mb-2 h-6 w-6" />
                <p className="text-sm">
                  {gh.connected
                    ? 'Select a repository and PR to get started'
                    : 'Connect your GitHub account to get started'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
