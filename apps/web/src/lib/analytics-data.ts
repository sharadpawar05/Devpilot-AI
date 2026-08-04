import type { AnalyticsData, DailyUsage } from './analytics-types';

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDailyUsage(days: number): DailyUsage[] {
  const result: DailyUsage[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    result.push({
      date: date.toISOString().split('T')[0],
      requests: randomBetween(5, 45),
      tokens: randomBetween(2000, 25000),
    });
  }
  return result;
}

export function generateMockAnalytics(): AnalyticsData {
  const dailyUsage = generateDailyUsage(30);
  const totalRequests = dailyUsage.reduce((s, d) => s + d.requests, 0);
  const totalTokens = dailyUsage.reduce((s, d) => s + d.tokens, 0);

  return {
    overview: {
      aiRequestsToday: randomBetween(8, 35),
      totalAIRequests: totalRequests,
      reposConnected: randomBetween(3, 12),
      prReviews: randomBetween(15, 80),
      codeReviews: randomBetween(20, 100),
      repositoryChats: randomBetween(10, 60),
      playgroundSessions: randomBetween(5, 40),
      tokensUsed: totalTokens,
      estimatedTimeSaved: randomBetween(12, 85),
      avgResponseTime: randomBetween(800, 3500),
      successRate: 94 + Math.random() * 5,
    },
    dailyUsage,
    featureUsage: [
      { feature: 'Code Review', count: randomBetween(20, 100), percentage: 28, color: '#8b5cf6' },
      { feature: 'PR Assistant', count: randomBetween(15, 80), percentage: 22, color: '#3b82f6' },
      {
        feature: 'Repository Chat',
        count: randomBetween(10, 60),
        percentage: 18,
        color: '#10b981',
      },
      { feature: 'AI Playground', count: randomBetween(5, 40), percentage: 14, color: '#ec4899' },
      {
        feature: 'Repository Overview',
        count: randomBetween(5, 30),
        percentage: 10,
        color: '#f59e0b',
      },
      {
        feature: 'Repository Health',
        count: randomBetween(3, 20),
        percentage: 5,
        color: '#ef4444',
      },
      { feature: 'Prompt Library', count: randomBetween(1, 10), percentage: 3, color: '#6366f1' },
    ],
    providerUsage: [
      {
        provider: 'Gemini',
        requests: randomBetween(40, 120),
        avgResponseTime: randomBetween(800, 2000),
        avgTokens: randomBetween(1500, 4000),
        successRate: 97 + Math.random() * 2,
        costEstimate: randomBetween(2, 15),
      },
      {
        provider: 'OpenAI',
        requests: randomBetween(20, 80),
        avgResponseTime: randomBetween(1000, 2500),
        avgTokens: randomBetween(2000, 5000),
        successRate: 95 + Math.random() * 3,
        costEstimate: randomBetween(5, 30),
      },
      {
        provider: 'Anthropic',
        requests: randomBetween(10, 50),
        avgResponseTime: randomBetween(1200, 3000),
        avgTokens: randomBetween(2000, 4500),
        successRate: 96 + Math.random() * 3,
        costEstimate: randomBetween(3, 20),
      },
    ],
    modelUsage: [
      { model: 'Gemini 2.5 Flash', count: randomBetween(30, 100), percentage: 35 },
      { model: 'GPT-4o', count: randomBetween(20, 70), percentage: 25 },
      { model: 'Claude Sonnet 4', count: randomBetween(15, 50), percentage: 20 },
      { model: 'Gemini 2.5 Pro', count: randomBetween(10, 30), percentage: 12 },
      { model: 'GPT-4o Mini', count: randomBetween(5, 20), percentage: 8 },
    ],
    reviewTypeUsage: [
      { type: 'Standard Review', count: randomBetween(20, 80), percentage: 40 },
      { type: 'Quick Scan', count: randomBetween(15, 60), percentage: 30 },
      { type: 'Deep Analysis', count: randomBetween(10, 40), percentage: 20 },
      { type: 'Security Review', count: randomBetween(5, 20), percentage: 10 },
    ],
    repositoryInsights: [
      {
        name: 'frontend-app',
        healthScore: 87,
        prReviews: 24,
        repoChats: 18,
        codeReviews: 32,
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
        topSuggestions: ['Add error boundaries', 'Improve test coverage', 'Refactor auth module'],
      },
      {
        name: 'api-server',
        healthScore: 72,
        prReviews: 15,
        repoChats: 12,
        codeReviews: 20,
        lastActivity: new Date(Date.now() - 7200000).toISOString(),
        topSuggestions: ['Add rate limiting', 'Optimize DB queries', 'Add input validation'],
      },
      {
        name: 'shared-lib',
        healthScore: 94,
        prReviews: 8,
        repoChats: 6,
        codeReviews: 14,
        lastActivity: new Date(Date.now() - 86400000).toISOString(),
        topSuggestions: ['Add JSDoc comments', 'Increase test coverage'],
      },
      {
        name: 'mobile-app',
        healthScore: 65,
        prReviews: 12,
        repoChats: 9,
        codeReviews: 16,
        lastActivity: new Date(Date.now() - 172800000).toISOString(),
        topSuggestions: ['Fix memory leaks', 'Optimize bundle size', 'Add offline support'],
      },
    ],
    productivity: {
      hoursSaved: randomBetween(15, 120),
      codeLinesReviewed: randomBetween(5000, 50000),
      prsImproved: randomBetween(20, 100),
      bugsPrevented: randomBetween(8, 45),
      documentationGenerated: randomBetween(10, 60),
      commitMessagesGenerated: randomBetween(50, 300),
    },
    recentActivity: [
      {
        id: '1',
        type: 'code-review',
        title: 'Reviewed auth module refactor',
        repository: 'frontend-app',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        model: 'Gemini 2.5 Flash',
      },
      {
        id: '2',
        type: 'pr-review',
        title: 'PR #42: Add user dashboard',
        repository: 'api-server',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        model: 'GPT-4o',
      },
      {
        id: '3',
        type: 'repo-chat',
        title: 'Questions about database schema',
        repository: 'api-server',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        model: 'Claude Sonnet 4',
      },
      {
        id: '4',
        type: 'playground',
        title: 'Experiment with regex patterns',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        model: 'Gemini 2.5 Flash',
      },
      {
        id: '5',
        type: 'repo-analysis',
        title: 'Analyzed repository structure',
        repository: 'shared-lib',
        timestamp: new Date(Date.now() - 28800000).toISOString(),
        model: 'Gemini 2.5 Flash',
      },
      {
        id: '6',
        type: 'code-review',
        title: 'Reviewed payment integration',
        repository: 'frontend-app',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        model: 'GPT-4o',
      },
    ],
  };
}
