import { useMemo } from 'react';
import type { AIHistorySessionMetadata } from '@devpilot/types';
import type { GitHubContextValue } from '@/hooks/use-github';
import type { SettingsState } from '@/lib/settings-context';

export type DateRange = 'today' | '7days' | '30days' | 'month';

export interface WorkspaceOverview {
  githubConnected: boolean;
  githubUser: string | null;
  githubAvatar: string | null;
  reposConnected: number;
  defaultRepo: string | null;
  defaultBranch: string;
  aiProvider: string;
  aiModel: string;
  totalSessions: number;
  lastActivity: string | null;
}

export interface AIUsageStats {
  totalRequests: number;
  repoChats: number;
  playgroundSessions: number;
  codeReviews: number;
  prReviews: number;
  repoAnalyses: number;
  totalTokens: number;
  avgLatency: number;
}

export interface FeatureUsageStat {
  feature: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RepositoryActivity {
  name: string;
  sessionCount: number;
  lastActivity: string | null;
  totalTokens: number;
  avgLatency: number;
  workflowTypes: string[];
}

export interface ProviderStat {
  provider: string;
  requestCount: number;
  avgResponseTime: number;
  totalTokens: number;
  models: string[];
}

export interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
}

interface AnalyticsData {
  overview: WorkspaceOverview;
  aiUsage: AIUsageStats;
  featureUsage: FeatureUsageStat[];
  repositoryActivity: RepositoryActivity[];
  providerStats: ProviderStat[];
  dailyUsage: DailyUsage[];
  recentActivity: AIHistorySessionMetadata[];
}

const FEATURE_COLORS: Record<string, string> = {
  'code-review': '#8b5cf6',
  'pr-review': '#3b82f6',
  'pr-analysis': '#3b82f6',
  'repository-chat': '#10b981',
  playground: '#ec4899',
  documentation: '#f59e0b',
  'test-generation': '#ef4444',
  'security-review': '#ef4444',
  'architecture-review': '#6366f1',
};

const FEATURE_LABELS: Record<string, string> = {
  'code-review': 'Code Review',
  'pr-review': 'PR Review',
  'pr-analysis': 'PR Analysis',
  'repository-chat': 'Repository Chat',
  playground: 'AI Playground',
  documentation: 'Documentation',
  'test-generation': 'Test Generation',
  'security-review': 'Security Review',
  'architecture-review': 'Architecture Review',
};

function getDateRangeStart(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case 'today':
      now.setHours(0, 0, 0, 0);
      return now;
    case '7days':
      now.setDate(now.getDate() - 7);
      return now;
    case '30days':
      now.setDate(now.getDate() - 30);
      return now;
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

function startOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export function useAnalytics(
  sessions: AIHistorySessionMetadata[],
  gh: GitHubContextValue,
  settings: SettingsState,
  dateRange: DateRange,
): AnalyticsData {
  return useMemo(() => {
    const rangeStart = getDateRangeStart(dateRange);
    const filtered = sessions.filter((s) => new Date(s.createdAt) >= rangeStart);

    // Workspace Overview
    const overview: WorkspaceOverview = {
      githubConnected: gh.connected,
      githubUser: gh.githubUser?.login ?? null,
      githubAvatar: gh.githubUser?.avatar_url ?? null,
      reposConnected: gh.repositories.length,
      defaultRepo: settings.github.defaultRepository || gh.selectedRepoName || null,
      defaultBranch: settings.github.defaultBranch,
      aiProvider: settings.ai.defaultProvider,
      aiModel: settings.ai.defaultModel,
      totalSessions: sessions.length,
      lastActivity: sessions.length > 0 ? sessions[0].updatedAt : null,
    };

    // AI Usage
    const aiUsage: AIUsageStats = {
      totalRequests: filtered.length,
      repoChats: filtered.filter((s) => s.workflowType === 'repository-chat').length,
      playgroundSessions: filtered.filter((s) => s.workflowType === 'playground').length,
      codeReviews: filtered.filter((s) => s.workflowType === 'code-review').length,
      prReviews: filtered.filter(
        (s) => s.workflowType === 'pr-review' || s.workflowType === 'pr-analysis',
      ).length,
      repoAnalyses: filtered.filter(
        (s) =>
          s.workflowType === 'documentation' ||
          s.workflowType === 'test-generation' ||
          s.workflowType === 'security-review' ||
          s.workflowType === 'architecture-review',
      ).length,
      totalTokens: filtered.reduce((sum, s) => sum + s.totalTokens, 0),
      avgLatency:
        filtered.length > 0
          ? Math.round(filtered.reduce((sum, s) => sum + s.totalLatency, 0) / filtered.length)
          : 0,
    };

    // Feature Usage
    const workflowCounts: Record<string, number> = {};
    for (const s of filtered) {
      workflowCounts[s.workflowType] = (workflowCounts[s.workflowType] || 0) + 1;
    }
    const featureUsage: FeatureUsageStat[] = Object.entries(workflowCounts)
      .map(([type, count]) => ({
        feature: FEATURE_LABELS[type] || type,
        count,
        percentage: filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0,
        color: FEATURE_COLORS[type] || '#6b7280',
      }))
      .sort((a, b) => b.count - a.count);

    // Repository Activity
    const repoMap = new Map<string, AIHistorySessionMetadata[]>();
    for (const s of filtered) {
      if (s.repository) {
        const existing = repoMap.get(s.repository) || [];
        existing.push(s);
        repoMap.set(s.repository, existing);
      }
    }
    const repositoryActivity: RepositoryActivity[] = Array.from(repoMap.entries())
      .map(([name, repoSessions]) => ({
        name,
        sessionCount: repoSessions.length,
        lastActivity:
          repoSessions.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          )[0]?.updatedAt || null,
        totalTokens: repoSessions.reduce((sum, s) => sum + s.totalTokens, 0),
        avgLatency: Math.round(
          repoSessions.reduce((sum, s) => sum + s.totalLatency, 0) / repoSessions.length,
        ),
        workflowTypes: [
          ...new Set(repoSessions.map((s) => FEATURE_LABELS[s.workflowType] || s.workflowType)),
        ],
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    // Provider Stats
    const providerMap = new Map<string, AIHistorySessionMetadata[]>();
    for (const s of filtered) {
      const existing = providerMap.get(s.provider) || [];
      existing.push(s);
      providerMap.set(s.provider, existing);
    }
    const providerStats: ProviderStat[] = Array.from(providerMap.entries())
      .map(([provider, provSessions]) => ({
        provider: provider.charAt(0).toUpperCase() + provider.slice(1),
        requestCount: provSessions.length,
        avgResponseTime: Math.round(
          provSessions.reduce((sum, s) => sum + s.totalLatency, 0) / provSessions.length,
        ),
        totalTokens: provSessions.reduce((sum, s) => sum + s.totalTokens, 0),
        models: [...new Set(provSessions.map((s) => s.model))],
      }))
      .sort((a, b) => b.requestCount - a.requestCount);

    // Daily Usage (last 30 days)
    const dailyMap = new Map<string, { requests: number; tokens: number }>();
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap.set(startOfDay(d), { requests: 0, tokens: 0 });
    }
    for (const s of filtered) {
      const day = startOfDay(new Date(s.createdAt));
      const existing = dailyMap.get(day);
      if (existing) {
        existing.requests += 1;
        existing.tokens += s.totalTokens;
      }
    }
    const dailyUsage: DailyUsage[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      requests: data.requests,
      tokens: data.tokens,
    }));

    // Recent Activity (latest 10)
    const recentActivity = [...sessions]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    return {
      overview,
      aiUsage,
      featureUsage,
      repositoryActivity,
      providerStats,
      dailyUsage,
      recentActivity,
    };
  }, [sessions, gh, settings, dateRange]);
}
