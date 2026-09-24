import { useState, useCallback } from 'react';
import {
  BarChart3,
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Users,
  GitPullRequest,
  GitCommit,
  AlertTriangle,
  Lightbulb,
  Copy,
  Download,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHub } from '@/hooks/use-github';
import { useEngineeringStatus } from '@/lib/engineering-status';
import { renderMarkdown } from '@/lib/markdown';
import { getErrorMessage } from '@/lib/error-messages';
import { useUsageLimitModal } from '@/hooks/use-usage-limit-modal';
import { UsageLimitModal } from '@/components/UsageLimitModal';
import { cn } from '@/lib/utils';
import type {
  EngineeringStatusData,
  EngineeringContributor,
  TeamTrend,
  EngineeringRisk,
  EngineeringBlocker,
  TeamHighlight,
  EngineeringRecommendation,
  TimeRange,
} from '@/lib/engineering-status';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function TrendIndicator({ trend }: { trend: TeamTrend }) {
  const icons = { up: TrendingUp, down: TrendingDown, stable: Minus };
  const colors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    stable: 'text-muted-foreground',
  };
  const Icon = icons[trend.direction];

  return (
    <div className="flex items-center justify-between rounded-md border bg-background p-3">
      <span className="text-sm font-medium">{trend.metric}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {trend.previous} → {trend.current}
        </span>
        <span
          className={cn('flex items-center gap-1 text-xs font-medium', colors[trend.direction])}
        >
          <Icon className="h-3 w-3" />
          {trend.change > 0 ? '+' : ''}
          {trend.change}%
        </span>
      </div>
    </div>
  );
}

function HighlightCard({ highlight }: { highlight: TeamHighlight }) {
  const colors = {
    positive: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
    neutral: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30',
    negative: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
  };
  return (
    <div className={cn('rounded-lg border p-4', colors[highlight.impact])}>
      <h4 className="font-medium">{highlight.title}</h4>
      <p className="mt-1 text-sm text-muted-foreground">{highlight.description}</p>
    </div>
  );
}

function RiskCard({ risk }: { risk: EngineeringRisk }) {
  const colors = {
    critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
    high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    low: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium">{risk.title}</h4>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            colors[risk.severity],
          )}
        >
          {risk.severity}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{risk.description}</p>
      <p className="mt-2 text-xs text-muted-foreground">Recommendation: {risk.recommendation}</p>
    </div>
  );
}

function BlockerCard({ blocker }: { blocker: EngineeringBlocker }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium">{blocker.title}</h4>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
            blocker.status === 'active'
              ? 'bg-red-500/10 text-red-600'
              : 'bg-green-500/10 text-green-600',
          )}
        >
          {blocker.status}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{blocker.description}</p>
      {blocker.affectedPrs && (
        <p className="mt-1 text-xs text-muted-foreground">Affected PRs: {blocker.affectedPrs}</p>
      )}
    </div>
  );
}

function ContributorRow({ contributor }: { contributor: EngineeringContributor }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background p-3">
      <img src={contributor.avatar_url} alt={contributor.login} className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{contributor.login}</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitCommit className="h-3 w-3" />
            {contributor.commits} commits
          </span>
          <span className="flex items-center gap-1">
            <GitPullRequest className="h-3 w-3" />
            {contributor.prsCreated} PRs
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {contributor.issuesClosed} issues
          </span>
          <span className="text-muted-foreground">
            +{contributor.linesAdded} -{contributor.linesDeleted}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: EngineeringRecommendation }) {
  const icons = { process: CheckCircle2, technical: Lightbulb, team: Users, quality: Shield };
  const Icon = icons[recommendation.category] || Lightbulb;
  const priorityColors = {
    high: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    medium: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    low: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">{recommendation.title}</h4>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
            priorityColors[recommendation.priority],
          )}
        >
          {recommendation.priority}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{recommendation.description}</p>
      <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
        {recommendation.category}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-6">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function formatAsMarkdown(data: EngineeringStatusData): string {
  const lines: string[] = [];
  lines.push('# Engineering Status Report');
  lines.push('');
  lines.push(
    `**Period:** ${data.timeRange.label} (${new Date(data.timeRange.start).toLocaleDateString()} to ${new Date(data.timeRange.end).toLocaleDateString()})`,
  );
  lines.push(`**Generated:** ${new Date(data.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(data.executiveSummary);
  lines.push('');
  lines.push('## Engineering Metrics');
  lines.push('');
  lines.push(`- PRs Created: ${data.engineeringMetrics.prsCreated}`);
  lines.push(`- PRs Merged: ${data.engineeringMetrics.prsMerged}`);
  lines.push(`- Commits: ${data.engineeringMetrics.commits}`);
  lines.push(`- Contributors: ${data.engineeringMetrics.contributors}`);
  lines.push(`- Avg Review Time: ${data.engineeringMetrics.reviewTime}h`);
  lines.push(`- Avg PR Size: ${data.engineeringMetrics.avgPrSize} lines`);
  lines.push(`- Open Issues: ${data.engineeringMetrics.openIssues}`);
  lines.push(`- Code Churn: ${data.engineeringMetrics.codeChurn}%`);
  lines.push('');
  if (data.teamHighlights.length > 0) {
    lines.push('## Team Highlights');
    lines.push('');
    for (const h of data.teamHighlights) {
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
      lines.push(`Recommendation: ${r.recommendation}`);
      lines.push('');
    }
  }
  if (data.contributors.length > 0) {
    lines.push('## Contributors');
    lines.push('');
    for (const c of data.contributors) {
      lines.push(
        `- **${c.login}:** ${c.commits} commits, ${c.prsCreated} PRs, +${c.linesAdded} -${c.linesDeleted}`,
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

export default function EngineeringStatusPage() {
  const gh = useGitHub();
  const generateMutation = useEngineeringStatus();
  const [selectedRepo, setSelectedRepo] = useState(
    () => localStorage.getItem('eng-status-selected-repo') || '',
  );
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [timeRange, setTimeRange] = useState<TimeRange>('14d');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState<EngineeringStatusData | null>(null);

  const owner = selectedRepo.split('/')[0] || '';
  const repo = selectedRepo.split('/')[1] || '';

  const handleRepoChange = useCallback(
    (fullName: string) => {
      setSelectedRepo(fullName);
      setSelectedBranch('main');
      setResult(null);
      localStorage.setItem('eng-status-selected-repo', fullName);
      if (fullName) {
        const [o, r] = fullName.split('/');
        gh.fetchBranches(o, r);
      }
    },
    [gh.fetchBranches],
  );

  const handleGenerate = useCallback(async () => {
    if (!owner || !repo) return;
    try {
      const response = await generateMutation.mutateAsync({
        owner,
        repo,
        branch: selectedBranch,
        timeRange,
        startDate: timeRange === 'custom' ? startDate : undefined,
        endDate: timeRange === 'custom' ? endDate : undefined,
        provider,
      });
      if (response.data) setResult(response.data);
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  }, [owner, repo, selectedBranch, timeRange, startDate, endDate, provider, generateMutation]);

  const handleCopy = useCallback(async () => {
    if (result) await navigator.clipboard.writeText(formatAsMarkdown(result));
  }, [result]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!result) return;
    const blob = new Blob([formatAsMarkdown(result)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engineering-status-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(
        `<html><head><title>Engineering Status Report</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:40px;max-width:800px;margin:0 auto}h1{border-bottom:2px solid #e5e7eb;padding-bottom:8px}h2{margin-top:24px}@media print{body{padding:20px}}</style></head><body><h1>Engineering Status Report</h1><p><strong>Period:</strong> ${result.timeRange.label}</p><p><strong>Generated:</strong> ${new Date().toLocaleString()}</p><hr/>${formatAsMarkdown(result).replace(/^## /gm, '<h2>').replace(/^### /gm, '<h3>').replace(/\n/g, '<br />')}</body></html>`,
      );
      printWindow.document.close();
      printWindow.print();
    }
  }, [result]);

  const canGenerate = selectedRepo && !generateMutation.isPending;
  const usageLimit = useUsageLimitModal(generateMutation.error);

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <UsageLimitModal
        details={usageLimit.details}
        open={usageLimit.open}
        onOpenChange={usageLimit.setOpen}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Engineering Status Report</h1>
        <p className="text-sm text-muted-foreground">
          Generate executive-ready engineering reports from repository activity.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
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
                onChange={(e) => setSelectedBranch(e.target.value)}
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
            <label htmlFor="timeRange" className="text-sm font-medium">
              Time Range
            </label>
            <div className="relative">
              <select
                id="timeRange"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className={`${selectClass} appearance-none pr-10`}
              >
                <option value="7d">Last 7 Days</option>
                <option value="14d">Last 14 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="custom">Custom Range</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="provider" className="text-sm font-medium">
              AI Provider
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
        {timeRange === 'custom' && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
        )}
        <div className="mt-4">
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
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

      {generateMutation.isPending && <LoadingSkeleton />}

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
            <MetricCard label="PRs Created" value={result.engineeringMetrics.prsCreated} />
            <MetricCard label="PRs Merged" value={result.engineeringMetrics.prsMerged} />
            <MetricCard label="Commits" value={result.engineeringMetrics.commits} />
            <MetricCard label="Contributors" value={result.engineeringMetrics.contributors} />
            <MetricCard
              label="Avg Review Time"
              value={`${result.engineeringMetrics.reviewTime}h`}
            />
            <MetricCard
              label="Avg PR Size"
              value={`${result.engineeringMetrics.avgPrSize} lines`}
            />
            <MetricCard label="Open Issues" value={result.engineeringMetrics.openIssues} />
            <MetricCard label="Code Churn" value={`${result.engineeringMetrics.codeChurn}%`} />
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Executive Summary</h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result.executiveSummary) }}
            />
          </div>

          {result.teamHighlights.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Team Highlights</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.teamHighlights.map((h, i) => (
                  <HighlightCard key={i} highlight={h} />
                ))}
              </div>
            </div>
          )}

          {result.trends.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                Team Trends
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.trends.map((t, i) => (
                  <TrendIndicator key={i} trend={t} />
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
                {result.risks.map((r, i) => (
                  <RiskCard key={i} risk={r} />
                ))}
              </div>
            </div>
          )}

          {result.blockers.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                Blockers
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.blockers.map((b, i) => (
                  <BlockerCard key={i} blocker={b} />
                ))}
              </div>
            </div>
          )}

          {result.contributors.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Top Contributors
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.contributors.map((c) => (
                  <ContributorRow key={c.login} contributor={c} />
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
                {result.recommendations.map((r, i) => (
                  <RecommendationCard key={i} recommendation={r} />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Generated {new Date(result.generatedAt).toLocaleString()}
            </span>
            <span>{result.timeRange.label}</span>
          </div>
        </div>
      )}

      {!result && !generateMutation.isPending && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No Report Generated</h3>
          <p className="text-sm text-muted-foreground">
            Select a repository and time range, then click "Generate Report".
          </p>
        </div>
      )}
    </div>
  );
}
