import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import type {
  EngineeringStatusRequest,
  EngineeringStatusResponse,
  EngineeringMetrics,
  EngineeringRisk,
  EngineeringBlocker,
  EngineeringContributor,
  TeamTrend,
} from './types';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export class EngineeringStatusService {
  async generateReport(
    userId: string,
    request: EngineeringStatusRequest,
  ): Promise<EngineeringStatusResponse> {
    const startTime = Date.now();
    const { owner, repo, branch, timeRange, startDate, endDate, provider = 'gemini' } = request;

    try {
      const dateRange = this.getDateRange(timeRange, startDate, endDate);

      const [pullRequests, commits, contributors, issues] = await Promise.all([
        repositoryIntelligenceService.getPullRequests(userId, owner, repo, 'all', 200),
        repositoryIntelligenceService.getCommits(userId, owner, repo, branch, 200),
        repositoryIntelligenceService.getContributors(userId, owner, repo, 50),
        repositoryIntelligenceService.getIssues(userId, owner, repo, 'all', 100).catch(() => []),
      ]);

      const filteredPRs = pullRequests.filter((pr) => {
        const prDate = new Date(pr.updated_at);
        return prDate >= dateRange.start && prDate <= dateRange.end;
      });

      const filteredCommits = commits.filter((commit) => {
        const commitDate = new Date(commit.author_date);
        return commitDate >= dateRange.start && commitDate <= dateRange.end;
      });

      const filteredIssues = issues.filter((issue: { created_at: string }) => {
        const issueDate = new Date(issue.created_at);
        return issueDate >= dateRange.start && issueDate <= dateRange.end;
      });

      const previousDateRange = this.getPreviousDateRange(dateRange);
      const previousPRs = pullRequests.filter((pr) => {
        const prDate = new Date(pr.updated_at);
        return prDate >= previousDateRange.start && prDate <= previousDateRange.end;
      });

      const metrics = this.calculateMetrics(filteredPRs, filteredCommits, filteredIssues);
      const previousMetrics = this.calculateMetrics(previousPRs, [], []);
      const trends = this.calculateTrends(metrics, previousMetrics);

      const contributorStats = this.buildContributorStats(
        filteredPRs,
        filteredCommits,
        filteredIssues,
        contributors,
      );

      const risks = this.identifyRisks(metrics);
      const blockers = this.identifyBlockers(filteredPRs, filteredIssues);

      const prompt = this.buildPrompt(
        request,
        metrics,
        contributorStats,
        risks,
        blockers,
        trends,
        dateRange,
      );

      const result = await aiService.generate(prompt.userPrompt, prompt.systemPrompt, {
        provider: provider as 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq',
        model: DEFAULT_MODEL,
        maxTokens: 4096,
      });

      const parsed = this.parseAIResponse(result.content);

      return {
        success: true,
        data: {
          ...parsed,
          engineeringMetrics: metrics,
          contributors: contributorStats,
          risks,
          blockers,
          trends,
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString(),
            label: this.getTimeRangeLabel(timeRange),
          },
        },
        latencyMs: result.latencyMs,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      const classified = classifyAIError(error);
      console.error('Engineering status AI generation failed:', error);
      return {
        success: false,
        error: {
          code: classified.code,
          message:
            classified.code === 'RATE_LIMIT_EXCEEDED'
              ? classified.message
              : `Failed to generate report. ${classified.message}`,
          retryable: classified.retryable,
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private getDateRange(timeRange: string, startDate?: string, endDate?: string) {
    const end = new Date();
    let start: Date;
    switch (timeRange) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        start = startDate
          ? new Date(startDate)
          : new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
        if (endDate) end.setTime(new Date(endDate).getTime());
        break;
      default:
        start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
    }
    return { start, end };
  }

  private getPreviousDateRange(dateRange: { start: Date; end: Date }) {
    const duration = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - duration),
      end: new Date(dateRange.start.getTime() - 1),
    };
  }

  private getTimeRangeLabel(timeRange: string): string {
    const labels: Record<string, string> = {
      '7d': 'Last 7 Days',
      '14d': 'Last 14 Days',
      '30d': 'Last 30 Days',
      custom: 'Custom Range',
    };
    return labels[timeRange] || 'Last 14 Days';
  }

  private calculateMetrics(
    pullRequests: Array<{
      state: string;
      merged?: boolean;
      additions?: number;
      deletions?: number;
      created_at: string;
      updated_at: string;
    }>,
    commits: Array<{ author: string | null }>,
    issues: Array<{ state?: string }>,
  ): EngineeringMetrics {
    const mergedPRs = pullRequests.filter((pr) => pr.merged || pr.state === 'closed');
    const openPRs = pullRequests.filter((pr) => pr.state === 'open');
    const totalAdditions = pullRequests.reduce((sum, pr) => sum + (pr.additions || 0), 0);
    const totalDeletions = pullRequests.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
    const avgPrSize =
      pullRequests.length > 0
        ? Math.round((totalAdditions + totalDeletions) / pullRequests.length)
        : 0;
    const reviewTime = this.estimateReviewTime(pullRequests);
    const codeChurn =
      totalAdditions + totalDeletions > 0
        ? Math.round((totalDeletions / (totalAdditions + totalDeletions)) * 100)
        : 0;

    return {
      prsCreated: pullRequests.length,
      prsMerged: mergedPRs.length,
      prsOpen: openPRs.length,
      prsClosed: pullRequests.filter((pr) => pr.state === 'closed').length,
      commits: commits.length,
      contributors: new Set(commits.filter((c) => c.author).map((c) => c.author)).size,
      reviewTime,
      avgPrSize,
      openIssues: issues.filter((i) => i.state === 'open').length,
      closedIssues: issues.filter((i) => i.state === 'closed').length,
      codeChurn,
      additions: totalAdditions,
      deletions: totalDeletions,
    };
  }

  private estimateReviewTime(
    pullRequests: Array<{
      created_at: string;
      updated_at: string;
      state: string;
      merged?: boolean;
      additions?: number;
      deletions?: number;
    }>,
  ): number {
    const mergedPRs = pullRequests.filter((pr) => pr.merged || pr.state === 'closed');
    if (mergedPRs.length === 0) return 0;
    const totalHours = mergedPRs.reduce((sum, pr) => {
      return (
        sum +
        (new Date(pr.updated_at).getTime() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60)
      );
    }, 0);
    return Math.round(totalHours / mergedPRs.length);
  }

  private calculateTrends(current: EngineeringMetrics, previous: EngineeringMetrics): TeamTrend[] {
    const calc = (curr: number, prev: number) =>
      prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
    const dir = (change: number): 'up' | 'down' | 'stable' =>
      change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
    return [
      {
        metric: 'PRs Created',
        current: current.prsCreated,
        previous: previous.prsCreated,
        change: calc(current.prsCreated, previous.prsCreated),
        direction: dir(calc(current.prsCreated, previous.prsCreated)),
      },
      {
        metric: 'PRs Merged',
        current: current.prsMerged,
        previous: previous.prsMerged,
        change: calc(current.prsMerged, previous.prsMerged),
        direction: dir(calc(current.prsMerged, previous.prsMerged)),
      },
      {
        metric: 'Commits',
        current: current.commits,
        previous: previous.commits,
        change: calc(current.commits, previous.commits),
        direction: dir(calc(current.commits, previous.commits)),
      },
      {
        metric: 'Avg PR Size',
        current: current.avgPrSize,
        previous: previous.avgPrSize,
        change: calc(current.avgPrSize, previous.avgPrSize),
        direction: dir(calc(current.avgPrSize, previous.avgPrSize)),
      },
      {
        metric: 'Code Churn',
        current: current.codeChurn,
        previous: previous.codeChurn,
        change: calc(current.codeChurn, previous.codeChurn),
        direction: dir(calc(current.codeChurn, previous.codeChurn)),
      },
    ];
  }

  private buildContributorStats(
    pullRequests: Array<{ user: string | null; additions?: number; deletions?: number }>,
    commits: Array<{ author: string | null }>,
    issues: Array<{ state?: string; user?: string | null }>,
    contributors: Array<{ login: string; avatar_url: string; contributions: number }>,
  ): EngineeringContributor[] {
    const statsMap = new Map<string, EngineeringContributor>();
    for (const c of contributors) {
      statsMap.set(c.login, {
        login: c.login,
        avatar_url: c.avatar_url,
        commits: 0,
        prsCreated: 0,
        prsReviewed: 0,
        issuesClosed: 0,
        linesAdded: 0,
        linesDeleted: 0,
      });
    }
    for (const pr of pullRequests) {
      if (pr.user) {
        const s = statsMap.get(pr.user);
        if (s) {
          s.prsCreated++;
          s.linesAdded += pr.additions || 0;
          s.linesDeleted += pr.deletions || 0;
        }
      }
    }
    for (const c of commits) {
      if (c.author) {
        const s = statsMap.get(c.author);
        if (s) s.commits++;
      }
    }
    for (const i of issues) {
      if (i.user && i.state === 'closed') {
        const s = statsMap.get(i.user as string);
        if (s) s.issuesClosed++;
      }
    }
    return Array.from(statsMap.values())
      .filter((s) => s.commits > 0 || s.prsCreated > 0 || s.issuesClosed > 0)
      .sort((a, b) => b.commits + b.prsCreated - (a.commits + a.prsCreated));
  }

  private identifyRisks(metrics: EngineeringMetrics): EngineeringRisk[] {
    const risks: EngineeringRisk[] = [];
    if (metrics.prsOpen > metrics.prsMerged * 0.5) {
      risks.push({
        title: 'High PR Backlog',
        description: `${metrics.prsOpen} open PRs may indicate review bottlenecks.`,
        severity: 'high',
        recommendation: 'Implement PR review rotations or automated checks.',
      });
    }
    if (metrics.avgPrSize > 500) {
      risks.push({
        title: 'Large PR Sizes',
        description: `Average PR size is ${metrics.avgPrSize} lines.`,
        severity: 'medium',
        recommendation: 'Encourage smaller, more focused PRs.',
      });
    }
    if (metrics.codeChurn > 40) {
      risks.push({
        title: 'High Code Churn',
        description: `Code churn at ${metrics.codeChurn}% indicates significant rework.`,
        severity: 'medium',
        recommendation: 'Review planning and requirements processes.',
      });
    }
    if (metrics.openIssues > 20) {
      risks.push({
        title: 'Growing Issue Backlog',
        description: `${metrics.openIssues} open issues need attention.`,
        severity: 'low',
        recommendation: 'Schedule regular issue triage sessions.',
      });
    }
    return risks;
  }

  private identifyBlockers(
    pullRequests: Array<{ title: string; state: string; changed_files?: number }>,
    _issues: Array<{ title?: string; state?: string; labels?: string[] }>,
  ): EngineeringBlocker[] {
    const blockers: EngineeringBlocker[] = [];
    const stalePRs = pullRequests.filter(
      (pr) => pr.state === 'open' && (pr.changed_files || 0) > 10,
    );
    if (stalePRs.length > 0) {
      blockers.push({
        title: 'Large Open PRs',
        description: `${stalePRs.length} PRs with many files changed need review.`,
        status: 'active',
        affectedPrs: stalePRs.length,
      });
    }
    return blockers;
  }

  private buildPrompt(
    request: EngineeringStatusRequest,
    metrics: EngineeringMetrics,
    contributors: EngineeringContributor[],
    risks: EngineeringRisk[],
    blockers: EngineeringBlocker[],
    trends: TeamTrend[],
    dateRange: { start: Date; end: Date },
  ) {
    const contributorSummary = contributors
      .slice(0, 10)
      .map(
        (c) =>
          `- ${c.login}: ${c.commits} commits, ${c.prsCreated} PRs, ${c.linesAdded}+ ${c.linesDeleted}-`,
      )
      .join('\n');
    const trendSummary = trends
      .map(
        (t) =>
          `- ${t.metric}: ${t.previous} -> ${t.current} (${t.change > 0 ? '+' : ''}${t.change}%)`,
      )
      .join('\n');
    const riskSummary = risks
      .map((r) => `- [${r.severity}] ${r.title}: ${r.description}`)
      .join('\n');

    const systemPrompt = `You are an expert Engineering Manager generating an executive-ready engineering status report.
Analyze the provided metrics and generate a comprehensive status report.
Be specific, data-driven, and focus on actionable insights for leadership.
Format your response as valid JSON matching the required structure.`;

    const userPrompt = `Generate an engineering status report for ${request.owner}/${request.repo} (branch: ${request.branch})
Period: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]}

## Engineering Metrics
- PRs Created: ${metrics.prsCreated} | Merged: ${metrics.prsMerged} | Open: ${metrics.prsOpen}
- Commits: ${metrics.commits} | Contributors: ${metrics.contributors}
- Avg Review Time: ${metrics.reviewTime}h | Avg PR Size: ${metrics.avgPrSize} lines
- Open Issues: ${metrics.openIssues} | Closed: ${metrics.closedIssues}
- Code Churn: ${metrics.codeChurn}% | Additions: +${metrics.additions} | Deletions: -${metrics.deletions}

## Top Contributors
${contributorSummary || 'No contributor data'}

## Trends (vs previous period)
${trendSummary || 'No trend data'}

## Risks
${riskSummary || 'No risks identified'}

## Blockers
${blockers.map((b) => `- ${b.title}: ${b.description}`).join('\n') || 'No blockers'}

Respond with JSON in this exact format:
{
  "executiveSummary": "2-3 paragraph executive summary for leadership",
  "teamHighlights": [
    { "title": "Highlight", "description": "Description", "impact": "positive|neutral|negative" }
  ],
  "recommendations": [
    { "title": "Recommendation", "description": "Description", "priority": "high|medium|low", "category": "process|technical|team|quality" }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  private parseAIResponse(response: string) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        executiveSummary: parsed.executiveSummary || response.slice(0, 1000),
        teamHighlights: Array.isArray(parsed.teamHighlights) ? parsed.teamHighlights : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch {
      return { executiveSummary: response.slice(0, 2000), teamHighlights: [], recommendations: [] };
    }
  }
}

export const engineeringStatusService = new EngineeringStatusService();
