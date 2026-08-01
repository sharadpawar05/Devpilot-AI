import { useState, useEffect, useCallback, useMemo } from 'react';
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
  FileText,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useGitHub,
  type GitHubRepo,
  type GitHubPull,
  type GitHubReviewResponse,
  type GitHubAnalyzeResponse,
} from '@/hooks/use-github';
import {
  renderMarkdown,
  extractSections,
  extractScore,
  getScoreColor,
  getScoreLabel,
  getScoreBg,
} from '@/lib/markdown';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const ANALYSIS_TYPES = [
  { value: 'full', label: 'Full Analysis', icon: BarChart3 },
  { value: 'review', label: 'Code Review Only', icon: FileCode },
] as const;

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
  'Loading Pull Request...',
  'Analyzing files...',
  'Generating review...',
  'Preparing documentation...',
  'Building checklists...',
];

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'review', label: 'AI Review', icon: FileCode },
  { id: 'docs', label: 'Documentation', icon: FileText },
  { id: 'quality', label: 'Quality', icon: ClipboardCheck },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
] as const;

type TabId = 'overview' | 'review' | 'docs' | 'quality' | 'metrics';

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

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  );
}

function MarkdownContent({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  const sections = useMemo(() => extractSections(text), [text]);

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

  if (sections.length <= 1) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <div className="divide-y divide-input">
      {sections.map((section, i) => (
        <div key={i} className="group relative px-4 py-3">
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(`## ${section.title}\n\n${section.content}`),
            }}
          />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(`## ${section.title}\n\n${section.content}`);
            }}
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({
  analyzeResult,
  selectedRepo,
  selectedPR,
  selectedFiles,
  files,
}: {
  analyzeResult: GitHubAnalyzeResponse | null;
  selectedRepo: GitHubRepo | null;
  selectedPR: GitHubPull | null;
  selectedFiles: Set<string>;
  files: { filename: string; additions: number; deletions: number }[];
}) {
  if (!selectedPR) return null;

  const fileTypes = analyzeResult?.fileTypes ?? 'unknown';
  const complexityMap: Record<string, string> = {
    docs: 'Low',
    config: 'Low',
    frontend: 'Medium',
    backend: 'Medium',
    'full-stack': 'High',
    mixed: 'Medium',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-input p-4">
        <h3 className="mb-3 text-sm font-semibold">Pull Request Overview</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Title</span>
            <span className="font-medium">
              #{selectedPR.number} - {selectedPR.title}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Repository</span>
            <span className="font-medium">{selectedRepo?.full_name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Author</span>
            <span className="font-medium">{selectedPR.user}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Files Changed</span>
            <span className="font-medium">{selectedPR.changed_files}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Lines</span>
            <span className="font-medium">
              <span className="text-green-500">+{selectedPR.additions}</span>
              {' / '}
              <span className="text-red-500">-{selectedPR.deletions}</span>
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">File Types</span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
              {fileTypes}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Review Complexity</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                complexityMap[fileTypes] === 'High'
                  ? 'bg-red-500/10 text-red-500'
                  : complexityMap[fileTypes] === 'Medium'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-green-500/10 text-green-500'
              }`}
            >
              {complexityMap[fileTypes] ?? 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {selectedFiles.size > 0 && (
        <div className="rounded-md border border-input p-4">
          <h3 className="mb-2 text-sm font-semibold">Selected Files ({selectedFiles.size})</h3>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {files
              .filter((f) => selectedFiles.has(f.filename))
              .map((f) => (
                <div key={f.filename} className="flex items-center gap-2 text-xs">
                  <FileCode className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono">{f.filename}</span>
                  <span className="text-green-500">+{f.additions}</span>
                  <span className="text-red-500">-{f.deletions}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {analyzeResult && (
        <div className="rounded-md border border-input p-4">
          <h3 className="mb-2 text-sm font-semibold">Executive Summary</h3>
          <MarkdownContent text={extractExecutiveSummary(analyzeResult.response)} />
        </div>
      )}
    </div>
  );
}

function extractExecutiveSummary(text: string): string {
  const lines = text.split('\n');
  const summaryLines: string[] = [];
  let inSummary = false;
  for (const line of lines) {
    if (/^(#|##)\s.*(summary|overview|executive)/i.test(line)) {
      inSummary = true;
      continue;
    }
    if (inSummary && /^##\s/.test(line)) break;
    if (inSummary) summaryLines.push(line);
  }
  if (summaryLines.length > 0) return summaryLines.join('\n').trim();

  const firstSection = text.split(/^## /m)[1];
  return firstSection ? firstSection.split('\n').slice(1).join('\n').trim() : text.slice(0, 500);
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [text, filename]);

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Download className="h-3.5 w-3.5" />
      .md
    </button>
  );
}

export function PullRequestAssistantPage() {
  const gh = useGitHub();

  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedPR, setSelectedPR] = useState<GitHubPull | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [analysisType, setAnalysisType] = useState<'full' | 'review'>('full');
  const [reviewType, setReviewType] = useState('Standard');
  const [reviewDepth, setReviewDepth] = useState('Standard');
  const [provider, setProvider] = useState('gemini');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [analyzeResult, setAnalyzeResult] = useState<GitHubAnalyzeResponse | null>(null);
  const [reviewResult, setReviewResult] = useState<GitHubReviewResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => {
    const result = analysisType === 'full' ? analyzeResult?.response : reviewResult?.response;
    return result ? extractScore(result) : null;
  }, [analysisType, analyzeResult, reviewResult]);

  const activeResponse = useMemo(() => {
    if (analysisType === 'full' && analyzeResult) return analyzeResult.response;
    if (analysisType === 'review' && reviewResult) return reviewResult.response;
    return null;
  }, [analysisType, analyzeResult, reviewResult]);

  const activeSections = useMemo(() => {
    return activeResponse ? extractSections(activeResponse) : [];
  }, [activeResponse]);

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

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    const url = await gh.connect('/pull-request-assistant');
    setConnecting(false);
    if (url) window.location.href = url;
  }, [gh]);

  const handleRepoSelect = useCallback(
    (fullName: string) => {
      const repo = gh.repositories.find((r) => r.full_name === fullName) ?? null;
      setSelectedRepo(repo);
      setSelectedPR(null);
      setSelectedFiles(new Set());
      setAnalyzeResult(null);
      setReviewResult(null);
      setError(null);
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
      setAnalyzeResult(null);
      setReviewResult(null);
      setError(null);
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

  const handleAnalyze = useCallback(async () => {
    if (!selectedRepo || !selectedPR) return;
    const [owner, name] = selectedRepo.full_name.split('/');
    setAnalyzing(true);
    setError(null);
    setAnalyzeResult(null);
    setReviewResult(null);

    try {
      if (analysisType === 'full') {
        const result = await gh.analyzePR({
          owner,
          repo: name,
          pull_number: selectedPR.number,
          provider,
        });
        if (result) {
          setAnalyzeResult(result);
          setActiveTab('overview');
        } else {
          setError('Analysis failed. Please try again.');
        }
      } else {
        const filesToReview = selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined;
        const result = await gh.reviewPR({
          owner,
          repo: name,
          pull_number: selectedPR.number,
          files: filesToReview,
          reviewType,
          reviewDepth,
          provider,
        });
        if (result) {
          setReviewResult(result);
          setActiveTab('review');
        } else {
          setError('Review failed. Please try again.');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    }
    setAnalyzing(false);
  }, [
    selectedRepo,
    selectedPR,
    analysisType,
    reviewType,
    reviewDepth,
    provider,
    selectedFiles,
    gh,
  ]);

  const canAnalyze = selectedRepo && selectedPR && !analyzing && !gh.loading;
  const hasResult = analyzeResult || reviewResult;

  const getActiveResultForTab = useCallback(
    (tab: TabId): string | null => {
      if (!activeResponse) return null;

      if (tab === 'overview') return extractExecutiveSummary(activeResponse);

      const tabSectionMap: Record<string, string[]> = {
        review: ['RISK', 'SECURITY', 'PERFORMANCE', 'ARCHITECTURE', 'RECOMMEND', 'VULNERAB'],
        docs: ['DESCRIPTION', 'COMMIT', 'RELEASE', 'CHANGELOG', 'MESSAGE'],
        quality: ['TEST', 'CHECKLIST', 'REVIEW', 'QUALITY', 'VALIDAT'],
      };

      const keywords = tabSectionMap[tab] ?? [];
      const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchingSections = activeSections.filter((s) => {
        const normTitle = normalize(s.title);
        return keywords.some((kw) => normTitle.includes(normalize(kw)));
      });

      if (matchingSections.length > 0) {
        return matchingSections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
      }

      return activeResponse;
    },
    [activeResponse, activeSections],
  );

  return (
    <div className="flex h-full">
      {/* Left Panel */}
      <div className="flex w-80 flex-1 flex-col overflow-y-auto border-r border-input">
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">PR Assistant</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-powered pull request analysis and documentation.
            </p>
          </div>

          <div className="space-y-4">
            {/* GitHub Account Section */}
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
                    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                      Connected
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={gh.disconnect} className="w-full">
                    <Unlink className="mr-1 h-3 w-3" />
                    Disconnect
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
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedFiles.size === 0
                    ? 'All files will be analyzed'
                    : `${selectedFiles.size} file(s) selected for review`}
                </p>
              </div>
            )}

            {/* Analysis Options */}
            {selectedPR && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="analysisType" className="text-sm font-medium">
                    Analysis Type
                  </label>
                  <div className="relative">
                    <select
                      id="analysisType"
                      value={analysisType}
                      onChange={(e) => setAnalysisType(e.target.value as 'full' | 'review')}
                      className={`${selectClass} appearance-none pr-10`}
                    >
                      {ANALYSIS_TYPES.map((at) => (
                        <option key={at.value} value={at.value}>
                          {at.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>

                {analysisType === 'review' && (
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>
                )}

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

            {/* Analyze Button */}
            {selectedPR && (
              <Button onClick={handleAnalyze} disabled={!canAnalyze} className="w-full">
                {analyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Analyze PR
                  </>
                )}
              </Button>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex-1 p-6">
          {/* Tabs */}
          {hasResult && (
            <div className="mb-6 flex flex-wrap gap-1 rounded-md border border-input bg-muted/30 p-1">
              {TAB_ITEMS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Metrics Bar */}
          {hasResult && (
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
                <p className="mt-1 text-sm font-semibold capitalize">
                  {analyzeResult?.provider ?? reviewResult?.provider ?? provider}
                </p>
              </div>
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Latency</p>
                <p className="mt-1 text-sm font-semibold">
                  {((analyzeResult?.latencyMs ?? reviewResult?.latencyMs ?? 0) / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Tokens</p>
                <p className="mt-1 text-sm font-semibold">
                  {(analyzeResult?.usage.total ?? reviewResult?.usage.total ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border border-input p-3 text-center">
                <p className="text-xs text-muted-foreground">Files</p>
                <p className="mt-1 text-sm font-semibold">
                  {analyzeResult?.pr.filesChanged ??
                    reviewResult?.pr.filesChanged ??
                    selectedPR?.changed_files ??
                    0}
                </p>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {hasResult && activeTab === 'overview' && (
            <div className="rounded-md border border-input bg-muted/20">
              <div className="flex items-center justify-between border-b border-input px-4 py-2">
                <span className="text-sm font-medium">
                  <BarChart3 className="mr-1 inline h-4 w-4" />
                  Overview
                </span>
                <div className="flex items-center gap-1">
                  <CopyButton text={activeResponse ?? ''} />
                  <DownloadButton text={activeResponse ?? ''} filename="pr-overview.md" />
                </div>
              </div>
              <div className="p-4">
                <OverviewTab
                  analyzeResult={analyzeResult}
                  selectedRepo={selectedRepo}
                  selectedPR={selectedPR}
                  selectedFiles={selectedFiles}
                  files={gh.files}
                />
              </div>
            </div>
          )}

          {hasResult && activeTab !== 'overview' && activeTab !== 'metrics' && (
            <div className="rounded-md border border-input bg-muted/20">
              <div className="flex items-center justify-between border-b border-input px-4 py-2">
                <span className="text-sm font-medium">
                  {TAB_ITEMS.find((t) => t.id === activeTab)?.icon &&
                    (() => {
                      const Icon = TAB_ITEMS.find((t) => t.id === activeTab)!.icon;
                      return <Icon className="mr-1 inline h-4 w-4" />;
                    })()}
                  {TAB_ITEMS.find((t) => t.id === activeTab)?.label}
                </span>
                <div className="flex items-center gap-1">
                  <CopyButton text={getActiveResultForTab(activeTab) ?? ''} />
                  <DownloadButton
                    text={getActiveResultForTab(activeTab) ?? ''}
                    filename={`pr-${activeTab}.md`}
                  />
                </div>
              </div>
              <div className="p-4">
                <MarkdownContent text={getActiveResultForTab(activeTab) ?? ''} />
              </div>
            </div>
          )}

          {hasResult && activeTab === 'metrics' && (
            <div className="space-y-4">
              <div className="rounded-md border border-input p-4">
                <h3 className="mb-3 text-sm font-semibold">AI Generation Metrics</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Provider</p>
                    <p className="text-sm font-medium capitalize">
                      {analyzeResult?.provider ?? reviewResult?.provider}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="text-sm font-medium">
                      {analyzeResult?.model ?? reviewResult?.model}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Latency</p>
                    <p className="text-sm font-medium">
                      {((analyzeResult?.latencyMs ?? reviewResult?.latencyMs ?? 0) / 1000).toFixed(
                        2,
                      )}
                      s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Input Tokens</p>
                    <p className="text-sm font-medium">
                      {(
                        analyzeResult?.usage.input ??
                        reviewResult?.usage.input ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Output Tokens</p>
                    <p className="text-sm font-medium">
                      {(
                        analyzeResult?.usage.output ??
                        reviewResult?.usage.output ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Tokens</p>
                    <p className="text-sm font-medium">
                      {(
                        analyzeResult?.usage.total ??
                        reviewResult?.usage.total ??
                        0
                      ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Timestamp</p>
                    <p className="text-sm font-medium">{new Date().toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Review Duration</p>
                    <p className="text-sm font-medium">
                      {((analyzeResult?.latencyMs ?? reviewResult?.latencyMs ?? 0) / 1000).toFixed(
                        1,
                      )}
                      s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Truncated</p>
                    <p className="text-sm font-medium">{analyzeResult?.truncated ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {(analyzing || gh.loading) && !hasResult && <LoadingProgress />}

          {/* Empty state */}
          {!hasResult && !error && !analyzing && !gh.loading && (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <div className="text-center">
                <GitPullRequest className="mx-auto mb-2 h-6 w-6" />
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
