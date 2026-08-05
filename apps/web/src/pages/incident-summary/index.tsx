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
  Clock,
  Shield,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGitHub } from '@/hooks/use-github';
import { useIncidentSummary } from '@/lib/incident-summary';
import { renderMarkdown } from '@/lib/markdown';
import { cn } from '@/lib/utils';
import type {
  IncidentSummaryData,
  IncidentFinding,
  IncidentTimeline,
  IncidentRecommendation,
} from '@/lib/incident-summary';

const selectClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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

function CategoryBadge({ category }: { category: string }) {
  const labels: Record<string, string> = {
    security: 'Security',
    performance: 'Performance',
    stability: 'Stability',
    code_quality: 'Code Quality',
    operational: 'Operational',
    immediate: 'Immediate',
    short_term: 'Short Term',
    long_term: 'Long Term',
  };
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
      {labels[category] || category}
    </span>
  );
}

function FindingCard({ finding }: { finding: IncidentFinding }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-orange-800 dark:text-orange-200">{finding.title}</h4>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">{finding.description}</p>
      <div className="mt-2">
        <CategoryBadge category={finding.category} />
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: IncidentTimeline }) {
  const impactColors = {
    high: 'border-red-500 bg-red-50 dark:bg-red-950/30',
    medium: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30',
    low: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
  };

  return (
    <div className={cn('rounded-lg border-l-4 p-4', impactColors[item.impact])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{item.date}</span>
        </div>
        <SeverityBadge severity={item.impact} />
      </div>
      <p className="mt-2 text-sm">{item.event}</p>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: IncidentRecommendation }) {
  const icons = {
    immediate: AlertTriangle,
    short_term: Lightbulb,
    long_term: Shield,
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
      <div className="mt-2">
        <CategoryBadge category={recommendation.category} />
      </div>
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

export default function IncidentSummaryPage() {
  const [selectedRepo, setSelectedRepo] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [provider, setProvider] = useState('gemini');
  const [result, setResult] = useState<IncidentSummaryData | null>(null);

  const gh = useGitHub();
  const generateMutation = useIncidentSummary();

  const handleRepoChange = useCallback(
    (value: string) => {
      setSelectedRepo(value);
      setSelectedBranch('main');
      gh.selectRepo(value);
    },
    [gh],
  );

  const handleBranchChange = useCallback(
    (value: string) => {
      setSelectedBranch(value);
      gh.selectBranch(value);
    },
    [gh],
  );

  const handleGenerate = useCallback(async () => {
    if (!selectedRepo || !startDate || !endDate) return;

    const [owner, repo] = selectedRepo.split('/');

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
      }
    } catch {
      // Error is handled by the mutation
    }
  }, [selectedRepo, selectedBranch, startDate, endDate, provider, generateMutation]);

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
    a.download = `incident-summary-${startDate}-to-${endDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, startDate, endDate]);

  const handleDownloadPDF = useCallback(() => {
    if (!result) return;
    const text = formatAsMarkdown(result);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Incident Summary ${startDate} to ${endDate}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #1a1a1a; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
              h2 { color: #374151; margin-top: 24px; }
              h3 { color: #4b5563; }
              p { line-height: 1.6; color: #4b5563; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>
            <h1>Incident Summary</h1>
            <p><strong>Period:</strong> ${startDate} to ${endDate}</p>
            <p><strong>Repository:</strong> ${selectedRepo}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <hr />
            ${text.replace(/^## /gm, '<h2>').replace(/^### /gm, '<h3>').replace(/\n/g, '<br />')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }, [result, startDate, endDate, selectedRepo]);

  const canGenerate = selectedRepo && startDate && endDate && !generateMutation.isPending;

  return (
    <div className="w-full px-6 py-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incident Summary</h1>
          <p className="text-sm text-muted-foreground">
            Generate incident analysis reports from repository activity during an incident window.
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

        {generateMutation.isError && (
          <div className="mt-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {generateMutation.error?.message || 'Failed to generate summary'}
          </div>
        )}
      </div>

      {generateMutation.isPending && (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold">Generating Incident Summary</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing repository activity and identifying incident patterns...
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
              label="Issues"
              value={`${result.metrics.totalIssuesOpened} opened`}
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <MetricCard
              label="Code Changes"
              value={`+${result.metrics.totalAdditions} -${result.metrics.totalDeletions}`}
              icon={<Activity className="h-4 w-4" />}
            />
          </div>

          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Executive Summary
            </h2>
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result.executiveSummary) }}
            />
          </div>

          {result.findings.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Key Findings
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {result.findings.map((finding, i) => (
                  <FindingCard key={i} finding={finding} />
                ))}
              </div>
            </div>
          )}

          {result.timeline.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Timeline
              </h2>
              <div className="space-y-3">
                {result.timeline.map((item, i) => (
                  <TimelineItem key={i} item={item} />
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
                Recommendations
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
              Generated in {(result.generatedAt ? 0 : 0) / 1000}s
            </span>
            <span>
              {result.incidentPeriod.start} to {result.incidentPeriod.end}
            </span>
          </div>
        </div>
      )}

      {!result && !generateMutation.isPending && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">No Summary Generated</h3>
          <p className="text-sm text-muted-foreground">
            Select a repository and date range, then click "Generate Summary" to create an incident
            report.
          </p>
        </div>
      )}
    </div>
  );
}

function formatAsMarkdown(data: IncidentSummaryData): string {
  const lines: string[] = [];

  lines.push(`# Incident Summary`);
  lines.push('');
  lines.push(`**Period:** ${data.incidentPeriod.start} to ${data.incidentPeriod.end}`);
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
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(data.executiveSummary);
  lines.push('');

  if (data.findings.length > 0) {
    lines.push('## Key Findings');
    lines.push('');
    for (const f of data.findings) {
      lines.push(`### ${f.title} (${f.severity} - ${f.category})`);
      lines.push(f.description);
      lines.push('');
    }
  }

  if (data.timeline.length > 0) {
    lines.push('## Timeline');
    lines.push('');
    for (const t of data.timeline) {
      lines.push(`- **${t.date}:** ${t.event} (${t.impact} impact)`);
    }
    lines.push('');
  }

  if (data.contributors.length > 0) {
    lines.push('## Contributors');
    lines.push('');
    for (const c of data.contributors) {
      lines.push(
        `- **${c.login}:** ${c.commits} commits, ${c.pullRequests} PRs, ${c.issuesOpened} issues`,
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
