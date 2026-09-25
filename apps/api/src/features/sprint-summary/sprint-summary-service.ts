import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import type {
  SprintSummaryRequest,
  SprintSummaryResponse,
  SprintMetrics,
  SprintContributor,
  SprintHighlight,
  SprintRisk,
  SprintRecommendation,
} from './types';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export class SprintSummaryService {
  async generateSummary(
    userId: string,
    request: SprintSummaryRequest,
  ): Promise<SprintSummaryResponse> {
    const startTime = Date.now();
    const { owner, repo, branch, startDate, endDate, provider = 'gemini' } = request;

    try {
      const [pullRequests, commits, contributors, releases, activity, issues] = await Promise.all([
        repositoryIntelligenceService.getPullRequests(userId, owner, repo, 'all', 100),
        repositoryIntelligenceService.getCommits(userId, owner, repo, branch, 100),
        repositoryIntelligenceService.getContributors(userId, owner, repo, 50),
        repositoryIntelligenceService.getReleases(userId, owner, repo, 20),
        repositoryIntelligenceService.getRecentActivity(userId, owner, repo, 100),
        repositoryIntelligenceService.getIssues(userId, owner, repo, 'all', 100).catch(() => []),
      ]);

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const filteredPRs = pullRequests.filter((pr) => {
        const prDate = new Date(pr.created_at);
        return prDate >= start && prDate <= end;
      });

      const filteredCommits = commits.filter((commit) => {
        const commitDate = new Date(commit.author_date);
        return commitDate >= start && commitDate <= end;
      });

      const filteredIssues = issues.filter((issue: { created_at: string }) => {
        const issueDate = new Date(issue.created_at);
        return issueDate >= start && issueDate <= end;
      });

      const filteredActivity = activity.filter((event) => {
        const eventDate = new Date(event.created_at);
        return eventDate >= start && eventDate <= end;
      });

      const metrics = this.calculateMetrics(
        filteredPRs,
        filteredCommits,
        filteredIssues,
        contributors,
      );

      const contributorStats = this.buildContributorStats(
        filteredPRs,
        filteredCommits,
        filteredIssues,
        contributors,
      );

      const prompt = this.buildPrompt(
        request,
        filteredPRs,
        filteredCommits,
        contributorStats,
        filteredIssues,
        filteredActivity,
        metrics,
        releases,
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
          metrics,
          contributors: contributorStats,
          generatedAt: new Date().toISOString(),
          sprintPeriod: { start: startDate, end: endDate },
        },
        latencyMs: result.latencyMs,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      const classified = classifyAIError(error);
      console.error('Sprint summary AI generation failed:', error);
      return {
        success: false,
        error: {
          code: classified.code,
          message:
            classified.code === 'RATE_LIMIT_EXCEEDED'
              ? classified.message
              : `Failed to generate sprint summary. ${classified.message}`,
          retryable: classified.retryable,
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private calculateMetrics(
    pullRequests: Array<{
      state: string;
      merged?: boolean;
      additions: number;
      deletions: number;
      changed_files: number;
    }>,
    commits: Array<{ author: string | null }>,
    issues: Array<{ state?: string }>,
    contributors: Array<{ login: string; contributions: number }>,
  ): SprintMetrics {
    const mergedPRs = pullRequests.filter((pr) => pr.merged || pr.state === 'closed');
    const openPRs = pullRequests.filter((pr) => pr.state === 'open');

    const totalAdditions = pullRequests.reduce((sum, pr) => sum + (pr.additions || 0), 0);
    const totalDeletions = pullRequests.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
    const totalFilesChanged = pullRequests.reduce((sum, pr) => sum + (pr.changed_files || 0), 0);

    const averagePrSize =
      pullRequests.length > 0
        ? Math.round((totalAdditions + totalDeletions) / pullRequests.length)
        : 0;

    const mergeRate =
      pullRequests.length > 0 ? Math.round((mergedPRs.length / pullRequests.length) * 100) : 0;

    return {
      totalPullRequests: pullRequests.length,
      mergedPullRequests: mergedPRs.length,
      openPullRequests: openPRs.length,
      totalCommits: commits.length,
      totalContributors: contributors.length,
      totalIssuesOpened: issues.length,
      totalIssuesClosed: issues.filter((i) => i.state === 'closed').length,
      totalAdditions,
      totalDeletions,
      totalFilesChanged,
      averagePrSize,
      mergeRate,
    };
  }

  private buildContributorStats(
    pullRequests: Array<{ user: string | null }>,
    commits: Array<{ author: string | null }>,
    issues: Array<{ state?: string; user?: string | null }>,
    contributors: Array<{ login: string; avatar_url: string; contributions: number }>,
  ): SprintContributor[] {
    const statsMap = new Map<string, SprintContributor>();

    for (const contributor of contributors) {
      statsMap.set(contributor.login, {
        login: contributor.login,
        avatar_url: contributor.avatar_url,
        contributions: contributor.contributions,
        pullRequests: 0,
        commits: 0,
        issuesOpened: 0,
        issuesClosed: 0,
      });
    }

    for (const pr of pullRequests) {
      if (pr.user) {
        const stats = statsMap.get(pr.user);
        if (stats) {
          stats.pullRequests++;
        }
      }
    }

    for (const commit of commits) {
      if (commit.author) {
        const stats = statsMap.get(commit.author);
        if (stats) {
          stats.commits++;
        }
      }
    }

    for (const issue of issues) {
      if (issue.user) {
        const stats = statsMap.get(issue.user as string);
        if (stats) {
          stats.issuesOpened++;
          if (issue.state === 'closed') {
            stats.issuesClosed++;
          }
        }
      }
    }

    return Array.from(statsMap.values())
      .filter((s) => s.pullRequests > 0 || s.commits > 0 || s.issuesOpened > 0)
      .sort((a, b) => b.pullRequests + b.commits - (a.pullRequests + a.commits));
  }

  private buildPrompt(
    request: SprintSummaryRequest,
    pullRequests: Array<{
      title: string;
      user: string | null;
      merged?: boolean;
      state: string;
      additions?: number;
      deletions?: number;
    }>,
    commits: Array<{ message: string; author: string | null }>,
    contributors: SprintContributor[],
    issues: Array<{ title?: string; state?: string; user?: string | null }>,
    activity: Array<{ type: string; actor?: string }>,
    metrics: SprintMetrics,
    releases: Array<{ tag_name: string; name: string | null; body?: string | null }>,
  ) {
    const prSummary = pullRequests
      .slice(0, 30)
      .map(
        (pr) => `- "${pr.title}" by ${pr.user || 'unknown'} [${pr.merged ? 'merged' : pr.state}]`,
      )
      .join('\n');

    const commitSummary = commits
      .slice(0, 50)
      .map((c) => `- ${c.message.split('\n')[0]} by ${c.author || 'unknown'}`)
      .join('\n');

    const contributorSummary = contributors
      .slice(0, 15)
      .map(
        (c) =>
          `- ${c.login}: ${c.commits} commits, ${c.pullRequests} PRs, ${c.issuesOpened} issues`,
      )
      .join('\n');

    const issueSummary = issues
      .slice(0, 20)
      .map((i) => `- "${i.title || 'Untitled'}" [${i.state}] by ${i.user || 'unknown'}`)
      .join('\n');

    const recentReleases = releases
      .slice(0, 5)
      .map((r) => `- ${r.tag_name}: ${r.name || 'No description'}`)
      .join('\n');

    const activitySummary = activity
      .slice(0, 30)
      .map((a) => `- ${a.type} by ${a.actor || 'unknown'}`)
      .join('\n');

    const systemPrompt = `You are an expert Engineering Manager generating a professional sprint summary report.
Analyze the provided repository activity data and generate a comprehensive sprint summary.
Be specific, data-driven, and focus on actionable insights.
Format your response as valid JSON matching the required structure.`;

    const userPrompt = `Generate a sprint summary for ${request.owner}/${request.repo} (branch: ${request.branch})
Sprint Period: ${request.startDate} to ${request.endDate}

## Metrics
- Pull Requests: ${metrics.totalPullRequests} total (${metrics.mergedPullRequests} merged, ${metrics.openPullRequests} open)
- Commits: ${metrics.totalCommits}
- Contributors: ${metrics.totalContributors}
- Issues: ${metrics.totalIssuesOpened} opened, ${metrics.totalIssuesClosed} closed
- Code Changes: +${metrics.totalAdditions} -${metrics.totalDeletions} lines across ${metrics.totalFilesChanged} files
- Average PR Size: ${metrics.averagePrSize} lines
- Merge Rate: ${metrics.mergeRate}%

## Pull Requests
${prSummary || 'No pull requests in this period'}

## Commits
${commitSummary || 'No commits in this period'}

## Contributors
${contributorSummary || 'No contributor data'}

## Issues
${issueSummary || 'No issues in this period'}

## Recent Releases
${recentReleases || 'No recent releases'}

## Recent Activity
${activitySummary || 'No activity data'}

Respond with JSON in this exact format:
{
  "executiveSummary": "2-3 paragraph executive summary of the sprint",
  "highlights": [
    { "title": "Highlight title", "description": "Description", "impact": "high|medium|low" }
  ],
  "risks": [
    { "title": "Risk title", "description": "Description", "severity": "critical|high|medium|low", "recommendation": "Recommendation" }
  ],
  "recommendations": [
    { "title": "Recommendation title", "description": "Description", "priority": "high|medium|low", "category": "process|technical|team|security" }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  private parseAIResponse(response: string): {
    executiveSummary: string;
    highlights: SprintHighlight[];
    risks: SprintRisk[];
    recommendations: SprintRecommendation[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        executiveSummary:
          parsed.executiveSummary || parsed.executive_summary || response.slice(0, 1000),
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      console.warn('Failed to parse AI response as JSON, returning raw text:', error);
      return {
        executiveSummary: response.slice(0, 2000),
        highlights: [],
        risks: [],
        recommendations: [],
      };
    }
  }
}

export const sprintSummaryService = new SprintSummaryService();
