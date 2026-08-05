import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import type {
  IncidentSummaryRequest,
  IncidentSummaryResponse,
  IncidentMetrics,
  IncidentContributor,
  IncidentFinding,
  IncidentTimeline,
  IncidentRecommendation,
} from './types';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export class IncidentSummaryService {
  async generateSummary(
    userId: string,
    request: IncidentSummaryRequest,
  ): Promise<IncidentSummaryResponse> {
    const startTime = Date.now();
    const { owner, repo, branch, startDate, endDate, provider = 'gemini' } = request;

    try {
      const [pullRequests, commits, contributors, issues] = await Promise.all([
        repositoryIntelligenceService.getPullRequests(userId, owner, repo, 'all', 100),
        repositoryIntelligenceService.getCommits(userId, owner, repo, branch, 100),
        repositoryIntelligenceService.getContributors(userId, owner, repo, 50),
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
        metrics,
      );

      const result = await aiService.generate(prompt.userPrompt, prompt.systemPrompt, {
        provider: provider as 'gemini' | 'openai' | 'anthropic' | 'openrouter',
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
          incidentPeriod: { start: startDate, end: endDate },
        },
        latencyMs: result.latencyMs,
        provider: result.provider,
        model: result.model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: `Failed to generate incident summary: ${message}`,
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
  ): IncidentMetrics {
    const mergedPRs = pullRequests.filter((pr) => pr.merged || pr.state === 'closed');

    const totalAdditions = pullRequests.reduce((sum, pr) => sum + (pr.additions || 0), 0);
    const totalDeletions = pullRequests.reduce((sum, pr) => sum + (pr.deletions || 0), 0);
    const totalFilesChanged = pullRequests.reduce((sum, pr) => sum + (pr.changed_files || 0), 0);

    return {
      totalPullRequests: pullRequests.length,
      mergedPullRequests: mergedPRs.length,
      totalCommits: commits.length,
      totalContributors: contributors.length,
      totalIssuesOpened: issues.length,
      totalIssuesClosed: issues.filter((i) => i.state === 'closed').length,
      totalAdditions,
      totalDeletions,
      totalFilesChanged,
    };
  }

  private buildContributorStats(
    pullRequests: Array<{ user: string | null }>,
    commits: Array<{ author: string | null }>,
    issues: Array<{ state?: string; user?: string | null }>,
    contributors: Array<{ login: string; avatar_url: string; contributions: number }>,
  ): IncidentContributor[] {
    const statsMap = new Map<string, IncidentContributor>();

    for (const contributor of contributors) {
      statsMap.set(contributor.login, {
        login: contributor.login,
        avatar_url: contributor.avatar_url,
        contributions: contributor.contributions,
        pullRequests: 0,
        commits: 0,
        issuesOpened: 0,
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
        }
      }
    }

    return Array.from(statsMap.values())
      .filter((s) => s.pullRequests > 0 || s.commits > 0 || s.issuesOpened > 0)
      .sort((a, b) => b.pullRequests + b.commits - (a.pullRequests + a.commits));
  }

  private buildPrompt(
    request: IncidentSummaryRequest,
    pullRequests: Array<{
      title: string;
      user: string | null;
      merged?: boolean;
      state: string;
      additions?: number;
      deletions?: number;
    }>,
    commits: Array<{ message: string; author: string | null }>,
    contributors: IncidentContributor[],
    issues: Array<{ title?: string; state?: string; user?: string | null }>,
    metrics: IncidentMetrics,
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

    const systemPrompt = `You are an expert incident response analyst generating a professional incident summary report.
Analyze the provided repository activity data during an incident window and generate a comprehensive incident summary.
Focus on: root cause analysis, timeline of events, impact assessment, and remediation recommendations.
Be specific, data-driven, and prioritize actionable findings.
Format your response as valid JSON matching the required structure.`;

    const userPrompt = `Generate an incident summary for ${request.owner}/${request.repo} (branch: ${request.branch})
Incident Period: ${request.startDate} to ${request.endDate}

## Metrics
- Pull Requests: ${metrics.totalPullRequests} total (${metrics.mergedPullRequests} merged)
- Commits: ${metrics.totalCommits}
- Contributors: ${metrics.totalContributors}
- Issues: ${metrics.totalIssuesOpened} opened, ${metrics.totalIssuesClosed} closed
- Code Changes: +${metrics.totalAdditions} -${metrics.totalDeletions} lines across ${metrics.totalFilesChanged} files

## Pull Requests
${prSummary || 'No pull requests in this period'}

## Commits
${commitSummary || 'No commits in this period'}

## Contributors
${contributorSummary || 'No contributor data'}

## Issues
${issueSummary || 'No issues in this period'}

Respond with JSON in this exact format:
{
  "executiveSummary": "2-3 paragraph executive summary of the incident",
  "findings": [
    { "title": "Finding title", "description": "Description", "severity": "critical|high|medium|low", "category": "security|performance|stability|code_quality|operational" }
  ],
  "timeline": [
    { "date": "YYYY-MM-DD HH:mm", "event": "Event description", "impact": "high|medium|low" }
  ],
  "recommendations": [
    { "title": "Recommendation title", "description": "Description", "priority": "high|medium|low", "category": "immediate|short_term|long_term" }
  ]
}`;

    return { systemPrompt, userPrompt };
  }

  private parseAIResponse(response: string): {
    executiveSummary: string;
    findings: IncidentFinding[];
    timeline: IncidentTimeline[];
    recommendations: IncidentRecommendation[];
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
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch {
      return {
        executiveSummary: response.slice(0, 2000),
        findings: [],
        timeline: [],
        recommendations: [],
      };
    }
  }
}

export const incidentSummaryService = new IncidentSummaryService();
