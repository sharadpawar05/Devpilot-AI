import { useState, useCallback } from 'react';
import { useAuth } from '@/auth';
import { useHistory } from '@/hooks/use-history';
import { useGitHub } from '@/hooks/use-github';
import { useSettingsState } from '@/lib/settings-context';
import { useAnalytics, type DateRange } from '@/hooks/use-analytics';
import { escapeHtml } from '@/lib/markdown';
import {
  Zap,
  BarChart3,
  Folder,
  GitPullRequest,
  FileCode,
  MessageSquare,
  Play,
  Coins,
  Clock,
  CheckCircle,
} from 'lucide-react';
import {
  MetricCard,
  UsageChart,
  FeatureBreakdown,
  RepositoryInsights,
  ProviderAnalytics,
  ProductivityCard,
  ActivityTimeline,
  FilterBar,
  AnalyticsEmptyState,
  AnalyticsPageSkeleton,
} from '@/components/analytics';

export default function AnalyticsPage() {
  const { isAuthenticated } = useAuth();
  const { sessions, isLoading: historyLoading } = useHistory();
  const gh = useGitHub();
  const settings = useSettingsState();
  const [dateRange, setDateRange] = useState<DateRange>('30days');

  const data = useAnalytics(sessions, gh, settings, dateRange);

  const handleExport = useCallback(
    (format: 'pdf' | 'csv' | 'json') => {
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'devpilot-analytics.json';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (format === 'csv') {
        const rows = [
          ['Metric', 'Value'],
          ['Total Sessions', String(data.overview.totalSessions)],
          ['Repos Connected', String(data.overview.reposConnected)],
          ['AI Provider', data.overview.aiProvider],
          ['AI Model', data.overview.aiModel],
          ['', ''],
          ['Feature', 'Count', 'Percentage'],
          ...data.featureUsage.map((f) => [f.feature, String(f.count), `${f.percentage}%`]),
          ['', ''],
          ['Provider', 'Requests', 'Avg Response (ms)', 'Total Tokens'],
          ...data.providerStats.map((p) => [
            p.provider,
            String(p.requestCount),
            String(p.avgResponseTime),
            String(p.totalTokens),
          ]),
          ['', ''],
          ['Repository', 'Sessions', 'Total Tokens'],
          ...data.repositoryActivity.map((r) => [
            r.name,
            String(r.sessionCount),
            String(r.totalTokens),
          ]),
        ];
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'devpilot-analytics.csv';
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      // PDF — open print-friendly HTML in new tab
      const html = `<!DOCTYPE html>
<html><head><title>DevPilot Analytics</title>
<style>
  body { font-family: -apple-system, sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
  .muted { color: #666; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #eee; }
  th { font-weight: 600; background: #f5f5f5; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { border: 1px solid #eee; border-radius: 8px; padding: 14px; }
  .card p { font-size: 22px; font-weight: 700; margin: 4px 0 0; }
  .card span { font-size: 12px; color: #666; }
  @media print { body { padding: 20px; } }
</style></head><body>
<h1>DevPilot Analytics Report</h1>
<p class="muted">Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

<h2>Overview</h2>
<div class="grid">
  <div class="card"><span>Total Sessions</span><p>${data.overview.totalSessions}</p></div>
  <div class="card"><span>Repositories</span><p>${data.overview.reposConnected}</p></div>
  <div class="card"><span>AI Provider</span><p>${escapeHtml(data.overview.aiProvider)}</p></div>
  <div class="card"><span>AI Model</span><p>${escapeHtml(data.overview.aiModel)}</p></div>
</div>

<h2>AI Usage</h2>
<div class="grid">
  <div class="card"><span>Total Requests</span><p>${data.aiUsage.totalRequests}</p></div>
  <div class="card"><span>Total Tokens</span><p>${data.aiUsage.totalTokens.toLocaleString()}</p></div>
  <div class="card"><span>PR Reviews</span><p>${data.aiUsage.prReviews}</p></div>
  <div class="card"><span>Code Reviews</span><p>${data.aiUsage.codeReviews}</p></div>
  <div class="card"><span>Repo Chats</span><p>${data.aiUsage.repoChats}</p></div>
  <div class="card"><span>Playground Sessions</span><p>${data.aiUsage.playgroundSessions}</p></div>
</div>

<h2>Feature Usage</h2>
<table>
<tr><th>Feature</th><th>Count</th><th>Percentage</th></tr>
${data.featureUsage.map((f) => `<tr><td>${escapeHtml(f.feature)}</td><td>${f.count}</td><td>${f.percentage}%</td></tr>`).join('\n')}
</table>

<h2>Provider Stats</h2>
<table>
<tr><th>Provider</th><th>Requests</th><th>Avg Response</th><th>Total Tokens</th><th>Models</th></tr>
${data.providerStats.map((p) => `<tr><td>${escapeHtml(p.provider)}</td><td>${p.requestCount}</td><td>${(p.avgResponseTime / 1000).toFixed(1)}s</td><td>${p.totalTokens.toLocaleString()}</td><td>${escapeHtml(p.models.join(', '))}</td></tr>`).join('\n')}
</table>

<h2>Repository Activity</h2>
<table>
<tr><th>Repository</th><th>Sessions</th><th>Total Tokens</th><th>Features Used</th></tr>
${data.repositoryActivity.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${r.sessionCount}</td><td>${r.totalTokens.toLocaleString()}</td><td>${escapeHtml(r.workflowTypes.join(', '))}</td></tr>`).join('\n')}
</table>

<h2>Daily Usage (Last 30 Days)</h2>
<table>
<tr><th>Date</th><th>Requests</th><th>Tokens</th></tr>
${data.dailyUsage
  .filter((d) => d.requests > 0)
  .map(
    (d) => `<tr><td>${d.date}</td><td>${d.requests}</td><td>${d.tokens.toLocaleString()}</td></tr>`,
  )
  .join('\n')}
</table>

</body></html>`;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
      }
    },
    [data],
  );

  if (historyLoading) return <AnalyticsPageSkeleton />;

  if (!isAuthenticated || sessions.length === 0) return <AnalyticsEmptyState />;

  const { overview, aiUsage } = data;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Track your DevPilot usage and productivity.
          </p>
        </div>
        <FilterBar active={dateRange} onChange={setDateRange} onExport={handleExport} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="AI Requests (Filtered)"
          value={aiUsage.totalRequests}
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          color="bg-amber-500/10"
        />
        <MetricCard
          label="Total Sessions"
          value={overview.totalSessions}
          icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
          color="bg-blue-500/10"
        />
        <MetricCard
          label="Repositories"
          value={overview.reposConnected}
          icon={<Folder className="h-5 w-5 text-purple-500" />}
          color="bg-purple-500/10"
        />
        <MetricCard
          label="Tokens Used"
          value={
            aiUsage.totalTokens >= 1000
              ? `${(aiUsage.totalTokens / 1000).toFixed(1)}k`
              : aiUsage.totalTokens
          }
          icon={<Coins className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-500/10"
        />
        <MetricCard
          label="Avg Latency"
          value={aiUsage.avgLatency > 0 ? `${(aiUsage.avgLatency / 1000).toFixed(1)}s` : '—'}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          color="bg-orange-500/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="PR Reviews"
          value={aiUsage.prReviews}
          icon={<GitPullRequest className="h-5 w-5 text-blue-500" />}
          color="bg-blue-500/10"
        />
        <MetricCard
          label="Code Reviews"
          value={aiUsage.codeReviews}
          icon={<FileCode className="h-5 w-5 text-purple-500" />}
          color="bg-purple-500/10"
        />
        <MetricCard
          label="Repository Chats"
          value={aiUsage.repoChats}
          icon={<MessageSquare className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-500/10"
        />
        <MetricCard
          label="Playground Sessions"
          value={aiUsage.playgroundSessions}
          icon={<Play className="h-5 w-5 text-pink-500" />}
          color="bg-pink-500/10"
        />
        <MetricCard
          label="Repo Analyses"
          value={aiUsage.repoAnalyses}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          color="bg-green-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UsageChart
          title="Daily AI Requests"
          data={data.dailyUsage}
          type="area"
          dataKey="requests"
          xKey="date"
          color="#8b5cf6"
        />
        <UsageChart
          title="Tokens Used"
          data={data.dailyUsage}
          type="area"
          dataKey="tokens"
          xKey="date"
          color="#3b82f6"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageChart
          title="Feature Usage"
          data={data.featureUsage.map((f) => ({ name: f.feature, count: f.count }))}
          type="pie"
          dataKey="count"
          xKey="name"
          height={280}
          showLegend
        />
        <UsageChart
          title="AI Providers"
          data={data.providerStats.map((p) => ({ name: p.provider, requests: p.requestCount }))}
          type="bar"
          dataKey="requests"
          xKey="name"
          color="#10b981"
          height={280}
        />
      </div>

      {/* Feature Breakdown + Productivity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeatureBreakdown data={data.featureUsage} />
        <ProductivityCard aiUsage={aiUsage} />
      </div>

      {/* Provider Analytics */}
      <ProviderAnalytics data={data.providerStats} />

      {/* Repository Insights */}
      <RepositoryInsights data={data.repositoryActivity} />

      {/* Recent Activity */}
      <ActivityTimeline data={data.recentActivity} />
    </div>
  );
}
