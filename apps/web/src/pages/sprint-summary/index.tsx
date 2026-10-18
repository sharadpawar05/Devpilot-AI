import { useState, useCallback } from 'react';
import {
  Calendar,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  AlertCircle,
  Users,
  GitPullRequest,
  GitCommit,
  AlertTriangle,
  Lightbulb,
  Copy,
  Download,
  BarChart3,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHub } from '@/hooks/use-github';
import { useSprintSummary } from '@/lib/sprint-summary';
import { renderMarkdown } from '@/lib/markdown';
import { openPrintableMarkdownReport } from '@/lib/print-report';
import { getErrorMessage } from '@/lib/error-messages';
import { useUsageLimitModal } from '@/hooks/use-usage-limit-modal';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { cn } from '@/lib/utils';
import type {
  SprintSummaryData,
  SprintHighlight,
  SprintRisk,
  SprintRecommendation,
} from '@/lib/sprint-summary';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function ImpactBadge({ impact }: { impact: string }) {
  const colors = {
    high: 'bg-green-500/10 text-green-600 dark:text-green-400',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        colors[impact as keyof typeof colors] || colors.low,
      )}
    >
      {impact}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
    high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        colors[severity as keyof typeof colors] || colors.low,
      )}
    >
      {severity}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    high: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    low: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        colors[priority as keyof typeof colors] || colors.low,
      )}
    >
      {priority}
    </span>
  );
}

function HighlightCard({ highlight }: { highlight: SprintHighlight }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium">{highlight.title}</h4>
        <ImpactBadge impact={highlight.impact} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{highlight.description}</p>
    </div>
  );
}

function RiskCard({ risk }: { risk: SprintRisk }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-orange-800 dark:text-orange-200">{risk.title}</h4>
        <SeverityBadge severity={risk.severity} />
      </div>
      <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">{risk.description}</p>
      <div className="mt-3 rounded-md bg-orange-100 p-3 dark:bg-orange-900/50">
        <p className="text-xs font-medium text-orange-800 dark:text-orange-200">Recommendation</p>
        <p className="mt-1 text-sm text-orange-700 dark:text-orange-300">{risk.recommendation}</p>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: SprintRecommendation }) {
  const icons = {
    process: CheckCircle2,
    technical: Lightbulb,
    team: Users,
    security: AlertTriangle,
  };
  const Icon = icons[recommendation.category] || Lightbulb;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">{recommendation.title}</h4>
        </div>
        <PriorityBadge priority={recommendation.priority} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{recommendation.description}</p>
      <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
        {recommendation.category}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ContributorRow({
  contributor,
}: {
  contributor: {
    login: string;
    avatar_url: string;
    pullRequests: number;
    commits: number;
    issuesOpened: number;
  };
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-3">
      <img src={contributor.avatar_url} alt={contributor.login} className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{contributor.login}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitPullRequest className="h-3 w-3" />
            {contributor.pullRequests} PRs
          </span>
          <span className="flex items-center gap-1">
            <GitCommit className="h-3 w-3" />
            {contributor.commits} commits
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {contributor.issuesOpened} issues
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SprintSummaryPage() {
  const gh = useGitHub();
  const generateMutation = useSprintSummary();

  const [selectedRepo, setSelectedRepo] = useState(() => {
    return localStorage.getItem('sprint-summary-selected-repo') || '';
  });
  const [selectedBranch, setSelectedBranch] = useState(() => {
    return localStorage.getItem('sprint-summary-selected-branch') || 'main';
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 14);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState<SprintSummaryData | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const owner = selectedRepo.split('/')[0] || '';
  const repo = selectedRepo.split('/')[1] || '';

  const handleRepoChange = useCallback(
    (fullName: string) => {
      setSelectedRepo(fullName);
      setSelectedBranch('main');
      setResult(null);
      localStorage.setItem('sprint-summary-selected-repo', fullName);
      if (fullName) {
        const [o, r] = fullName.split('/');
        gh.fetchBranches(o, r);
      }
    },
    [gh.fetchBranches],
  );

  const handleBranchChange = useCallback((branch: string) => {
    setSelectedBranch(branch);
    localStorage.setItem('sprint-summary-selected-branch', branch);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!owner || !repo) return;

    try {
      const response = await generateMutation.mutateAsync({
        owner,
        repo,
        branch: selectedBranch,
        startDate,
        endDate,
        provider,
      });

      if (response.data) {
        setResult(response.data);
        setLatencyMs(response.latencyMs ?? null);
      }
    } catch {
      // Error is handled by the mutation
    }
  }, [owner, repo, selectedBranch, startDate, endDate, provider, generateMutation]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    await navigator.clipboard.writeText(text);
  }, [result]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sprint-summary-${startDate}-to-${endDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, startDate, endDate]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    openPrintableMarkdownReport({
      title: `Sprint Summary ${startDate} to ${endDate}`,
      meta: [
        { label: 'Period', value: `${startDate} to ${endDate}` },
        { label: 'Repository', value: `${owner}/${repo}` },
        { label: 'Generated', value: new Date().toLocaleString() },
      ],
      markdownBody: formatAsMarkdown(result),
    });
  }, [result, startDate, endDate, owner, repo]);

  const canGenerate = selectedRepo && startDate && endDate && !generateMutation.isPending;
  const usageLimit = useUsageLimitModal(generateMutation.error);

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <UsageLimitModal
        details={usageLimit.details}
        open={usageLimit.open}
        onOpenChange={usageLimit.setOpen}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sprint Summary</h1>
          <p className="text-sm text-muted-foreground">
            Generate professional sprint summaries from repository activity.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          Configuration
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="repo" className="text-sm font-medium">
              Repository
            </label>
            <div className="relative">
              <select
                id="repo"
                value={selectedRepo}
                onChange={(e) => handleRepoChange(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
              >
                <option value="">Select repository...</option>
                {gh.repositories.map((r) => (
                  <option key={r.full_name} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="branch" className="text-sm font-medium">
              Branch
            </label>
            <div className="relative">
              <select
                id="branch"
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className={`${selectClass} appearance-none pr-10`}
                disabled={!selectedRepo}
              >
                {(gh.branches || []).map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="startDate" className="text-sm font-medium">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={selectClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="endDate" className="text-sm font-medium">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={selectClass}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="space-y-1.5">
            <label htmlFor="provider" className="text-sm font-medium">
              AI Provider
            </label>
            <div className="relative">
              <select
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className={`${selectClass} w-auto appearance-none pr-10`}
              >
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={!canGenerate} className="mt-5">
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>
        </div>

        {generateMutation.isError &&
          !usageLimit.isLimitError &&
          (() => {
            const err = generateMutation.error;
            const code =
              (err as { code?: string } | undefined)?.code ||
              (err as { response?: { code?: string } } | undefined)?.response?.code;
            const friendly = getErrorMessage({
              code,
              message: err?.message,
            });
            return (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{friendly.title}</p>
                  <p>{friendly.message}</p>
                  {friendly.suggestion && (
                    <p className="mt-1 text-xs opacity-80">{friendly.suggestion}</p>
                  )}
                </div>
              </div>
            );
          })()}
      </div>

      {generateMutation.isPending && (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold">Generating Sprint Summary</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing repository activity and generating insights...
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Generated Report</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                <RefreshCw
                  className={cn('mr-1.5 h-3.5 w-3.5', generateMutation.isPending && 'animate-spin')}
                />
                Regenerate
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Pull Requests"
              value={`${result.metrics.mergedPullRequests}/${result.metrics.totalPullRequests}`}
              icon={<GitPullRequest className="h-4 w-4" />}
            />
            <MetricCard
              label="Commits"
              value={result.metrics.totalCommits}
              icon={<GitCommit className="h-4 w-4" />}
            />
            <MetricCard
              label="Contributors"
              value={result.metrics.totalContributors}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label="Merge Rate"
              value={`${result.metrics.mergeRate}%`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Executive Summary
            </h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result.executiveSummary) }}
            />
          </div>

          {result.highlights.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                Sprint Highlights
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.highlights.map((highlight, i) => (
                  <HighlightCard key={i} highlight={highlight} />
                ))}
              </div>
            </div>
          )}

          {result.risks.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                Risks
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.risks.map((risk, i) => (
                  <RiskCard key={i} risk={risk} />
                ))}
              </div>
            </div>
          )}

          {result.contributors.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Contributor Breakdown
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.contributors.map((contributor) => (
                  <ContributorRow key={contributor.login} contributor={contributor} />
                ))}
              </div>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-muted-foreground" />
                AI Recommendations
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.recommendations.map((recommendation, i) => (
                  <RecommendationCard key={i} recommendation={recommendation} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Generated in {latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : 'N/A'}
            </span>
            <span>
              {result.sprintPeriod.start} to {result.sprintPeriod.end}
            </span>
          </div>
        </div>
      )}

      {!result && !generateMutation.isPending && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No Summary Generated</h3>
          <p className="text-sm text-muted-foreground">
            Select a repository and date range, then click "Generate Summary" to create a sprint
            report.
          </p>
        </div>
      )}
    </div>
  );
}

function formatAsMarkdown(data: SprintSummaryData): string {
  const lines: string[] = [];

  lines.push(`# Sprint Summary`);
  lines.push('');
  lines.push(`**Period:** ${data.sprintPeriod.start} to ${data.sprintPeriod.end}`);
  lines.push(`**Generated:** ${new Date(data.generatedAt).toLocaleString()}`);
  lines.push('');

  lines.push('## Metrics');
  lines.push('');
  lines.push(
    `- **Pull Requests:** ${data.metrics.mergedPullRequests}/${data.metrics.totalPullRequests} merged`,
  );
  lines.push(`- **Commits:** ${data.metrics.totalCommits}`);
  lines.push(`- **Contributors:** ${data.metrics.totalContributors}`);
  lines.push(
    `- **Issues:** ${data.metrics.totalIssuesOpened} opened, ${data.metrics.totalIssuesClosed} closed`,
  );
  lines.push(
    `- **Code Changes:** +${data.metrics.totalAdditions} -${data.metrics.totalDeletions} lines`,
  );
  lines.push(`- **Merge Rate:** ${data.metrics.mergeRate}%`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(data.executiveSummary);
  lines.push('');

  if (data.highlights.length > 0) {
    lines.push('## Sprint Highlights');
    lines.push('');
    for (const h of data.highlights) {
      lines.push(`### ${h.title} (${h.impact})`);
      lines.push(h.description);
      lines.push('');
    }
  }

  if (data.risks.length > 0) {
    lines.push('## Risks');
    lines.push('');
    for (const r of data.risks) {
      lines.push(`### ${r.title} (${r.severity})`);
      lines.push(r.description);
      lines.push(`**Recommendation:** ${r.recommendation}`);
      lines.push('');
    }
  }

  if (data.contributors.length > 0) {
    lines.push('## Contributors');
    lines.push('');
    for (const c of data.contributors) {
      lines.push(
        `- **${c.login}:** ${c.pullRequests} PRs, ${c.commits} commits, ${c.issuesOpened} issues`,
      );
    }
    lines.push('');
  }

  if (data.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const r of data.recommendations) {
      lines.push(`### ${r.title} (${r.priority} - ${r.category})`);
      lines.push(r.description);
      lines.push('');
    }
  }

  return lines.join('\n');
}
