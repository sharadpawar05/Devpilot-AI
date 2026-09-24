import { useState, useCallback, useEffect } from 'react';
import {
  RefreshCw,
  Star,
  GitFork,
  AlertCircle,
  Users,
  Scale,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  Code,
  FileText,
  FolderOpen,
  Shield,
  Zap,
  Loader2,
  ChevronDown,
  Bot,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { repoOverviewApi } from '@/lib/repo-overview/api';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-messages';
import {
  MetricCard,
  LanguageBar,
  CompactHealthScore,
  FileTree,
  ContributorList,
  FullPageSkeleton,
  TechnologyStackCard,
} from '@/components/repo-overview';
import { RepositoryGrid } from '@/components/repository';
import { RepositoryIntelligencePanel } from '@/components/repo-intelligence';
import type { RepoOverviewData, TechnologyStack } from '@/lib/repo-overview';

function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

interface RepoSelectorProps {
  repositories: Array<{ full_name: string; name: string }>;
  branches: Array<{ name: string; is_default?: boolean }>;
  selectedRepo: string;
  selectedBranch: string;
  onRepoChange: (fullName: string) => void;
  onBranchChange: (branch: string) => void;
}

function RepoSelector({
  repositories,
  branches,
  selectedRepo,
  selectedBranch,
  onRepoChange,
  onBranchChange,
}: RepoSelectorProps) {
  const selectClass =
    'rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none cursor-pointer';

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <select
          value={selectedRepo}
          onChange={(e) => onRepoChange(e.target.value)}
          className={`${selectClass} pr-10 min-w-[200px]`}
        >
          <option value="">Select repository...</option>
          {repositories.map((r) => (
            <option key={r.full_name} value={r.full_name}>
              {r.full_name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {selectedRepo && branches.length > 0 && (
        <div className="relative">
          <select
            value={selectedBranch}
            onChange={(e) => onBranchChange(e.target.value)}
            className={`${selectClass} pr-10 min-w-[140px]`}
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export default function RepositoryOverviewPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const gh = useGitHub();
  const navigate = useNavigate();

  const [selectedRepo, setSelectedRepo] = useState(() => {
    try {
      return localStorage.getItem('repo-overview-selected-repo') || '';
    } catch {
      return '';
    }
  });
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      return localStorage.getItem('repo-overview-selected-branch') || 'main';
    } catch {
      return 'main';
    }
  });
  const [overviewData, setOverviewData] = useState<RepoOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message?: string } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<{ code?: string; message?: string } | null>(
    null,
  );
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [techStack, setTechStack] = useState<TechnologyStack | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const owner = selectedRepo.split('/')[0] || '';
  const repo = selectedRepo.split('/')[1] || '';

  useEffect(() => {
    try {
      if (selectedRepo) localStorage.setItem('repo-overview-selected-repo', selectedRepo);
    } catch {
      // localStorage may be unavailable
    }
  }, [selectedRepo]);

  useEffect(() => {
    try {
      if (selectedBranch) localStorage.setItem('repo-overview-selected-branch', selectedBranch);
    } catch {
      // localStorage may be unavailable
    }
  }, [selectedBranch]);

  const fetchOverview = useCallback(async () => {
    if (!owner || !repo || !token) return;

    setIsLoading(true);
    setError(null);
    setOverviewData(null);
    setSummary(null);

    try {
      const result = await repoOverviewApi.getOverview(owner, repo, token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch repository overview');
      }

      setOverviewData(result.data);
    } catch (err) {
      // Never expose raw error messages - use structured error codes
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';

      // Try to parse error code from message if it's a JSON-like error
      let errorCode: string | undefined;
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.code) errorCode = parsed.code;
      } catch {
        // Not JSON - check for known patterns
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          errorCode = 'REPOSITORY_NOT_FOUND';
        } else if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
          errorCode = 'GITHUB_AUTH_FAILED';
        } else if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          errorCode = 'GITHUB_RATE_LIMIT';
        } else if (errorMessage.includes('timeout')) {
          errorCode = 'DATABASE_TIMEOUT';
        }
      }

      setError({ code: errorCode, message: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [owner, repo, token]);

  const generateSummary = useCallback(async () => {
    if (!owner || !repo || !token) return;

    setIsGeneratingSummary(true);
    setSummaryError(null);

    try {
      const result = await repoOverviewApi.generateSummary(owner, repo, token);
      if (!result.success || !result.summary) {
        throw new Error(result.error || 'Failed to generate summary');
      }
      setSummary(result.summary);
    } catch (err) {
      // Never expose raw error messages - use structured error codes
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate summary';
      setSummaryError({ code: 'AI_ERROR', message: errorMessage });
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [owner, repo, token]);

  const fetchTechStack = useCallback(async () => {
    if (!owner || !repo || !token) return;

    setIsAnalyzing(true);
    try {
      const result = await repoOverviewApi.analyze(owner, repo, token);
      if (result.success && result.stack) {
        setTechStack(result.stack);
      }
    } catch {
      // Silently fail - tech stack is non-critical
    } finally {
      setIsAnalyzing(false);
    }
  }, [owner, repo, token]);

  useEffect(() => {
    if (owner && repo && token) {
      fetchOverview();
      fetchTechStack();
    }
  }, [owner, repo, token, fetchOverview, fetchTechStack]);

  useEffect(() => {
    if (owner && repo && token) {
      gh.fetchBranches(owner, repo).catch(() => {});
    }
  }, [owner, repo, token, gh.fetchBranches]);

  const handleRepoChange = useCallback(
    (fullName: string) => {
      setSelectedRepo(fullName);
      setSelectedBranch('main');
      setOverviewData(null);
      setSummary(null);
      setError(null);
      setTechStack(null);
      if (fullName) {
        const [o, r] = fullName.split('/');
        gh.fetchBranches(o, r);
      }
    },
    [gh.fetchBranches],
  );

  const handleBranchChange = useCallback((branch: string) => {
    setSelectedBranch(branch);
    setOverviewData(null);
    setSummary(null);
    setError(null);
    setTechStack(null);
  }, []);

  const metadata = overviewData?.metadata;

  if (!selectedRepo) {
    return (
      <div className="w-full px-6 py-12">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="mb-2 text-lg font-semibold">Repository Overview</h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Select a repository to view its overview, file structure, languages, and health score.
            </p>
            <div className="mt-6 flex justify-center">
              <RepoSelector
                repositories={gh.repositories}
                branches={gh.branches || []}
                selectedRepo={selectedRepo}
                selectedBranch={selectedBranch}
                onRepoChange={handleRepoChange}
                onBranchChange={handleBranchChange}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Browse repositories</h3>
            <RepositoryGrid
              repositories={gh.repositories}
              selectedRepo={selectedRepo}
              onSelect={handleRepoChange}
              onChat={(fullName) => {
                handleRepoChange(fullName);
                navigate('/repository-chat');
              }}
              onReview={(fullName) => {
                handleRepoChange(fullName);
                navigate('/code-review');
              }}
              onAnalyze={(fullName) => handleRepoChange(fullName)}
              loading={gh.loading}
              skeletonCount={6}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading state - show full skeleton
  if (isLoading && !metadata) {
    return (
      <div className="w-full space-y-6 p-6">
        <FullPageSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header with Repo Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <RepoSelector
          repositories={gh.repositories}
          branches={gh.branches || []}
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
          onRepoChange={handleRepoChange}
          onBranchChange={handleBranchChange}
        />
        <Button variant="outline" size="sm" onClick={fetchOverview} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                {getErrorMessage(error).title}
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {getErrorMessage(error).message}
              </p>
              {getErrorMessage(error).suggestion && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {getErrorMessage(error).suggestion}
                </p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchOverview}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Repository Header */}
      {metadata && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src={metadata.owner.avatar_url}
                  alt={metadata.owner.login}
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{metadata.name}</h1>
                  <p className="text-sm text-muted-foreground">{metadata.owner.login}</p>
                </div>
              </div>
              {metadata.description && (
                <p className="text-sm text-muted-foreground max-w-2xl">{metadata.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={metadata.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                GitHub
              </a>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
              {metadata.visibility === 'public' ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {metadata.visibility}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
              <Code className="h-3 w-3" />
              {metadata.language || 'Unknown'}
            </span>
            {metadata.license && (
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
                <Scale className="h-3 w-3" />
                {metadata.license.spdx_id}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
              <Clock className="h-3 w-3" />
              Updated {timeAgo(metadata.updated_at)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium">
              <FolderOpen className="h-3 w-3" />
              {metadata.default_branch}
            </span>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metadata && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard
            label="Stars"
            value={metadata.stargazers_count.toLocaleString()}
            icon={<Star className="h-4 w-4" />}
          />
          <MetricCard
            label="Forks"
            value={metadata.forks_count.toLocaleString()}
            icon={<GitFork className="h-4 w-4" />}
          />
          <MetricCard
            label="Open Issues"
            value={metadata.open_issues_count.toLocaleString()}
            icon={<AlertCircle className="h-4 w-4" />}
          />
          <MetricCard
            label="Watchers"
            value={metadata.watchers_count.toLocaleString()}
            icon={<Eye className="h-4 w-4" />}
          />
          <MetricCard
            label="Size"
            value={formatSize(metadata.size)}
            icon={<FolderOpen className="h-4 w-4" />}
          />
          <MetricCard
            label="Primary Language"
            value={metadata.language || 'Unknown'}
            icon={<Code className="h-4 w-4" />}
          />
          <MetricCard
            label="License"
            value={metadata.license?.spdx_id || 'None'}
            icon={<Scale className="h-4 w-4" />}
          />
          <MetricCard
            label="Created"
            value={formatDate(metadata.created_at)}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>
      )}

      {/* AI Summary */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-foreground" />
            Repository Summary
          </h2>
          {!summary && !isGeneratingSummary && (
            <Button variant="outline" size="sm" onClick={generateSummary} disabled={!metadata}>
              <Zap className="mr-1.5 h-3.5 w-3.5" />
              Generate Summary
            </Button>
          )}
          {summary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSummary}
              disabled={isGeneratingSummary}
            >
              <RefreshCw
                className={cn('mr-1.5 h-3.5 w-3.5', isGeneratingSummary && 'animate-spin')}
              />
              Regenerate
            </Button>
          )}
        </div>

        {isGeneratingSummary && (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Generating AI summary...</span>
          </div>
        )}

        {summaryError && (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/30">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              {getErrorMessage(summaryError).title}
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {getErrorMessage(summaryError).message}
            </p>
            {getErrorMessage(summaryError).suggestion && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {getErrorMessage(summaryError).suggestion}
              </p>
            )}
          </div>
        )}

        {summary && !isGeneratingSummary && (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{
              __html: (() => {
                try {
                  return renderMarkdown(summary);
                } catch {
                  return '<p class="text-red-600">Failed to render summary</p>';
                }
              })(),
            }}
          />
        )}

        {!summary && !isGeneratingSummary && !summaryError && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Click "Generate Summary" to get an AI-powered overview of this repository.
          </p>
        )}
      </div>

      {/* Technology Stack */}
      {(techStack || isAnalyzing) && (
        <TechnologyStackCard
          stack={techStack || {}}
          className={isAnalyzing ? 'animate-pulse' : ''}
        />
      )}

      {/* Repository Intelligence */}
      {owner && repo && (
        <RepositoryIntelligencePanel owner={owner} repo={repo} branch={selectedBranch} />
      )}

      {/* Content Grid: Structure + Languages + Health */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Repository Structure */}
        <div className="lg:col-span-1 rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            Structure
            {overviewData && (
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                {overviewData.totalFiles} files · {overviewData.totalDirectories} dirs
              </span>
            )}
          </h2>
          {overviewData?.tree ? (
            <FileTree
              tree={overviewData.tree}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              maxHeight="400px"
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isLoading ? 'Loading...' : 'No file structure available'}
            </p>
          )}
        </div>

        {/* Languages + Health */}
        <div className="lg:col-span-2 space-y-6">
          {/* Language Breakdown */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Code className="h-5 w-5 text-muted-foreground" />
              Programming Languages
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">GitHub language statistics</p>
            {overviewData?.languages && Object.keys(overviewData.languages).length > 0 ? (
              <LanguageBar languages={overviewData.languages} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isLoading ? 'Loading...' : 'No language data available'}
              </p>
            )}
          </div>

          {/* Health Score */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Repository Health
            </h2>
            {overviewData?.health ? (
              <CompactHealthScore
                health={overviewData.health}
                onViewDetails={() =>
                  navigate(
                    `/health-overview?repo=${encodeURIComponent(selectedRepo)}&branch=${encodeURIComponent(selectedBranch)}`,
                  )
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isLoading ? 'Loading...' : 'No health data available'}
              </p>
            )}
          </div>

          {/* Contributors */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Contributors
            </h2>
            {overviewData?.contributors && overviewData.contributors.length > 0 ? (
              <div className="space-y-4">
                <ContributorList contributors={overviewData.contributors} maxDisplay={12} />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {overviewData.contributors.slice(0, 6).map((c) => (
                    <a
                      key={c.login}
                      href={c.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm transition-colors hover:bg-accent"
                    >
                      <img
                        src={c.avatar_url}
                        alt={c.login}
                        className="h-6 w-6 rounded-full"
                        loading="lazy"
                      />
                      <span className="truncate font-medium">{c.login}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {c.contributions}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No contributors data available
              </p>
            )}
          </div>
        </div>
      </div>

      {/* File Detail Panel */}
      {selectedFile && (
        <FileDetailPanel
          owner={owner}
          repo={repo}
          path={selectedFile}
          token={token}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}

function FileDetailPanel({
  owner,
  repo,
  path,
  token,
  onClose,
}: {
  owner: string;
  repo: string;
  path: string;
  token?: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setContent(null);

    repoOverviewApi
      .getFileContent(owner, repo, path, token)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError({ code: 'FILE_LOAD_FAILED', message: result.error || 'Failed to load file' });
        } else {
          setContent(result.content || '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Never expose raw error messages
        setError({ code: 'FILE_LOAD_FAILED', message: 'Unable to load file content.' });
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, path, token]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-sm font-medium">{path}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="max-h-[400px] overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">Loading file...</span>
          </div>
        )}
        {error && (
          <div className="py-4 text-center text-sm text-red-600">
            {getErrorMessage(error).message}
          </div>
        )}
        {content !== null && !loading && (
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
            <code>{content}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
