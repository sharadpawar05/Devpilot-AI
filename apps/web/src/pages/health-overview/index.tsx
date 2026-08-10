import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, ChevronDown, Loader2, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { repoOverviewApi } from '@/lib/repo-overview/api';
import { getErrorMessage } from '@/lib/error-messages';
import {
  HealthScore,
  HealthDimensions,
  TopFindings,
  FullPageSkeleton,
  GenerationModal,
} from '@/components/repo-overview';
import type { RepoOverviewData, HealthActionType } from '@/lib/repo-overview';

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

export default function HealthOverviewPage() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const gh = useGitHub();

  const [selectedRepo, setSelectedRepo] = useState(() => {
    try {
      return localStorage.getItem('health-overview-selected-repo') || '';
    } catch {
      return '';
    }
  });
  const [selectedBranch, setSelectedBranch] = useState(() => {
    try {
      return localStorage.getItem('health-overview-selected-branch') || 'main';
    } catch {
      return 'main';
    }
  });
  const [overviewData, setOverviewData] = useState<RepoOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ code?: string; message?: string } | null>(null);
  const [generationModal, setGenerationModal] = useState<{
    open: boolean;
    actionType: HealthActionType;
  }>({ open: false, actionType: 'none' });

  const owner = selectedRepo.split('/')[0] || '';
  const repo = selectedRepo.split('/')[1] || '';

  useEffect(() => {
    try {
      if (selectedRepo) localStorage.setItem('health-overview-selected-repo', selectedRepo);
    } catch {
      // localStorage may be unavailable
    }
  }, [selectedRepo]);

  useEffect(() => {
    try {
      if (selectedBranch) localStorage.setItem('health-overview-selected-branch', selectedBranch);
    } catch {
      // localStorage may be unavailable
    }
  }, [selectedBranch]);

  const fetchOverview = useCallback(async () => {
    if (!owner || !repo || !token) return;

    setIsLoading(true);
    setError(null);
    setOverviewData(null);

    try {
      const result = await repoOverviewApi.getOverview(owner, repo, token);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch repository overview');
      }

      setOverviewData(result.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      let errorCode: string | undefined;
      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.code) errorCode = parsed.code;
      } catch {
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

  useEffect(() => {
    if (owner && repo && token) {
      fetchOverview();
    }
  }, [owner, repo, token, fetchOverview]);

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
      setError(null);
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
    setError(null);
  }, []);

  const handleGenerate = useCallback((actionType: HealthActionType) => {
    setGenerationModal({ open: true, actionType });
  }, []);

  const handleCloseGenerationModal = useCallback(() => {
    setGenerationModal({ open: false, actionType: 'none' });
  }, []);

  const handleGenerateReport = useCallback(() => {
    if (!overviewData?.health || !overviewData?.metadata) return;

    const h = overviewData.health;
    const s = h.summary;
    const metadata = overviewData.metadata;
    const now = new Date().toISOString();

    const lines: string[] = [
      `# Repository Health Report`,
      '',
      `**Repository:** ${metadata.full_name}`,
      `**Branch:** ${metadata.default_branch}`,
      `**Language:** ${metadata.language || 'Unknown'}`,
      `**Generated:** ${now}`,
      '',
      `---`,
      '',
      `## Overall Health Score`,
      '',
      `**${h.score} / 100** — ${
        h.score >= 90
          ? 'Excellent'
          : h.score >= 80
            ? 'Good'
            : h.score >= 70
              ? 'Fair'
              : h.score >= 50
                ? 'Needs Attention'
                : 'Needs Work'
      }`,
      '',
      `- **${h.passedCount}** checks passed`,
      `- **${h.failedCount}** checks failed`,
      `- **${h.criticalCount}** critical issues`,
      '',
      `## Score Breakdown`,
      '',
      `| Category | Score |`,
      `|---|---|`,
      `| Structural | ${s.structuralScore}/100 |`,
      `| Quality | ${s.qualityScore}/100 |`,
      s.securityScore !== undefined ? `| Security | ${s.securityScore}/100 |` : '',
      s.dependencyScore !== undefined ? `| Dependencies | ${s.dependencyScore}/100 |` : '',
      s.maintainabilityScore !== undefined
        ? `| Maintainability | ${s.maintainabilityScore}/100 |`
        : '',
      '',
      `## Checks`,
      '',
    ];

    const passed = h.details.filter((d) => d.passed);
    const failed = h.details.filter(
      (d) => !d.passed && d.status !== 'not_applicable' && d.status !== 'not_measured',
    );
    const skipped = h.details.filter(
      (d) => d.status === 'not_applicable' || d.status === 'not_measured',
    );

    if (passed.length > 0) {
      lines.push(`### Passed (${passed.length})`, '');
      for (const d of passed) lines.push(`- ✅ **${d.name}** — ${d.failedDescription}`);
      lines.push('');
    }

    if (failed.length > 0) {
      lines.push(`### Failed (${failed.length})`, '');
      for (const d of failed) {
        lines.push(`- ❌ **${d.name}** (${d.severity}) — penalty: -${d.scorePenalty}`);
        lines.push(`  - ${d.failedDescription}`);
        lines.push(`  - Recommendation: ${d.recommendation}`);
      }
      lines.push('');
    }

    if (skipped.length > 0) {
      lines.push(`### Not Applicable / Not Measured (${skipped.length})`, '');
      for (const d of skipped) lines.push(`- ⏭️ **${d.name}** — ${d.status.replace('_', ' ')}`);
      lines.push('');
    }

    const securityCheck = h.details.find((d) => d.id === 'security');
    if (
      securityCheck?.quality?.vulnerabilities &&
      securityCheck.quality.vulnerabilities.length > 0
    ) {
      lines.push(`## Security Findings`, '');
      for (const v of securityCheck.quality.vulnerabilities) {
        lines.push(`- **${v.severity.toUpperCase()}** — ${v.package}: ${v.description}`);
      }
      lines.push('');
    }

    const depCheck = h.details.find((d) => d.id === 'dependencies');
    if (depCheck?.quality) {
      lines.push(`## Dependencies`, '');
      lines.push(`- Total: ${depCheck.quality.totalDependencies ?? 'unknown'}`);
      lines.push(
        `- Outdated: ${depCheck.quality.outdatedDependencies ?? 0} (${depCheck.quality.outdatedPercentage ?? 0}%)`,
      );
      lines.push('');
    }

    const complexityCheck = h.details.find((d) => d.id === 'complexity');
    if (complexityCheck?.quality) {
      lines.push(`## Code Complexity`, '');
      lines.push(`- Score: ${complexityCheck.quality.complexityScore ?? 'unknown'}/100`);
      if (complexityCheck.quality.largeFiles && complexityCheck.quality.largeFiles.length > 0) {
        lines.push(`- Large files:`);
        for (const f of complexityCheck.quality.largeFiles.slice(0, 5)) {
          lines.push(`  - ${f.path} (${f.lines} lines)`);
        }
      }
      lines.push('');
    }

    const hotspotCheck = h.details.find((d) => d.id === 'hotspots');
    if (hotspotCheck?.quality?.hotspots && hotspotCheck.quality.hotspots.length > 0) {
      lines.push(`## Code Hotspots`, '');
      lines.push(`- ${hotspotCheck.quality.hotspots.length} hotspot files detected`);
      for (const hs of hotspotCheck.quality.hotspots.slice(0, 5)) {
        lines.push(`  - ${hs.path} (churn: ${hs.changeFrequency}, size: ${hs.sizeBytes} bytes)`);
      }
      lines.push('');
    }

    const debtCheck = h.details.find((d) => d.id === 'debt');
    if (debtCheck?.quality?.debtItems && debtCheck.quality.debtItems.length > 0) {
      lines.push(`## Technical Debt`, '');
      lines.push(`- Score: ${debtCheck.quality.debtScore ?? 'unknown'}/100`);
      for (const item of debtCheck.quality.debtItems.slice(0, 5)) {
        lines.push(`- ${item.pattern}: ${item.count} occurrences (${item.severity})`);
      }
      lines.push('');
    }

    lines.push(`---`, `*Report generated by Devpilot AI*`);

    const blob = new Blob([lines.filter(Boolean).join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.name}-health-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [overviewData]);

  if (!selectedRepo) {
    return (
      <div className="w-full px-6 py-20 flex flex-col items-center justify-center">
        <div className="rounded-lg border border-dashed bg-card p-12 text-center w-full max-w-lg">
          <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-lg font-semibold">Health Overview</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Select a repository to view its comprehensive health analysis and recommendations.
          </p>
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
    );
  }

  if (isLoading && !overviewData) {
    return (
      <div className="w-full space-y-6 p-6">
        <FullPageSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <RepoSelector
          repositories={gh.repositories}
          branches={gh.branches || []}
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
          onRepoChange={handleRepoChange}
          onBranchChange={handleBranchChange}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOverview} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          {overviewData?.health && (
            <Button variant="outline" size="sm" onClick={handleGenerateReport}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export Report
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-red-500 shrink-0" />
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

      {/* Health Dimensions Grid */}
      {overviewData?.health?.summary && <HealthDimensions summary={overviewData.health.summary} />}

      {/* Main Health Score + Findings */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Full Health Score */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Health Score
            </h2>
            {overviewData?.health ? (
              <HealthScore
                health={overviewData.health}
                onGenerate={handleGenerate}
                onGenerateReport={handleGenerateReport}
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isLoading ? 'Loading...' : 'No health data available'}
              </p>
            )}
          </div>
        </div>

        {/* Top Findings Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              Findings Summary
            </h2>
            {overviewData?.health?.details ? (
              <TopFindings details={overviewData.health.details} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isLoading ? 'Loading...' : 'No findings available'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Generation Modal */}
      <GenerationModal
        open={generationModal.open}
        onClose={handleCloseGenerationModal}
        owner={owner}
        repo={repo}
        actionType={generationModal.actionType}
        currentBranch={selectedBranch}
      />
    </div>
  );
}
