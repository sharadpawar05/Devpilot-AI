import { useState, useMemo, useCallback } from 'react';
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
import type { DateRange } from '@/lib/analytics-types';
import { generateMockAnalytics } from '@/lib/analytics-data';
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
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [isLoading] = useState(false);

  const data = useMemo(() => generateMockAnalytics(), []);

  const handleExport = useCallback(
    (format: 'pdf' | 'csv' | 'json') => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devpilot-analytics.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [data],
  );

  if (isLoading) return <AnalyticsPageSkeleton />;

  if (!data) return <AnalyticsEmptyState />;

  const { overview } = data;

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
          label="AI Requests Today"
          value={overview.aiRequestsToday}
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          color="bg-amber-500/10"
          change={12}
        />
        <MetricCard
          label="Total AI Requests"
          value={overview.totalAIRequests.toLocaleString()}
          icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
          color="bg-blue-500/10"
          change={8}
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
            overview.tokensUsed >= 1000
              ? `${(overview.tokensUsed / 1000).toFixed(1)}k`
              : overview.tokensUsed
          }
          icon={<Coins className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-500/10"
          change={15}
        />
        <MetricCard
          label="Success Rate"
          value={`${overview.successRate.toFixed(1)}%`}
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          color="bg-green-500/10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="PR Reviews"
          value={overview.prReviews}
          icon={<GitPullRequest className="h-5 w-5 text-blue-500" />}
          color="bg-blue-500/10"
          change={5}
        />
        <MetricCard
          label="Code Reviews"
          value={overview.codeReviews}
          icon={<FileCode className="h-5 w-5 text-purple-500" />}
          color="bg-purple-500/10"
          change={10}
        />
        <MetricCard
          label="Repository Chats"
          value={overview.repositoryChats}
          icon={<MessageSquare className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-500/10"
        />
        <MetricCard
          label="Playground Sessions"
          value={overview.playgroundSessions}
          icon={<Play className="h-5 w-5 text-pink-500" />}
          color="bg-pink-500/10"
        />
        <MetricCard
          label="Time Saved"
          value={`${overview.estimatedTimeSaved}h`}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          color="bg-orange-500/10"
          change={20}
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

      <div className="grid gap-6 lg:grid-cols-3">
        <UsageChart
          title="Feature Usage"
          data={data.featureUsage}
          type="pie"
          dataKey="count"
          xKey="feature"
          height={280}
          showLegend
        />
        <UsageChart
          title="AI Providers"
          data={data.providerUsage}
          type="bar"
          dataKey="requests"
          xKey="provider"
          color="#10b981"
          height={280}
        />
        <UsageChart
          title="Review Types"
          data={data.reviewTypeUsage}
          type="bar"
          dataKey="count"
          xKey="type"
          color="#f59e0b"
          height={280}
        />
      </div>

      {/* Feature Breakdown + Productivity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FeatureBreakdown data={data.featureUsage} />
        <ProductivityCard data={data.productivity} />
      </div>

      {/* Provider Analytics */}
      <ProviderAnalytics data={data.providerUsage} />

      {/* Repository Insights */}
      <RepositoryInsights data={data.repositoryInsights} />

      {/* Recent Activity */}
      <ActivityTimeline data={data.recentActivity} />
    </div>
  );
}
