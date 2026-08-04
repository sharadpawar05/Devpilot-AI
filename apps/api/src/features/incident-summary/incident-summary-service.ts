import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import type {
  IncidentSummaryRequest,
  IncidentSummaryResponse,
  IncidentPR,
  IncidentCommit,
  IncidentContributor,
  IncidentTimelineEvent,
} from './types';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export class IncidentSummaryService {
  async generateReport(
    userId: string,
    request: IncidentSummaryRequest,
  ): Promise<IncidentSummaryResponse> {
    const startTime = Date.now();
    const {
      owner,
      repo,
      branch,
      incidentTitle,
      severity,
      startDate,
      endDate,
      description: _description,
      provider = 'gemini',
    } = request;

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const [pullRequests, commits, contributors] = await Promise.all([
        repositoryIntelligenceService.getPullRequests(userId, owner, repo, 'all', 200),
        repositoryIntelligenceService.getCommits(userId, owner, repo, branch, 200),
        repositoryIntelligenceService.getContributors(userId, owner, repo, 50),
      ]);

      const relatedPRs = this.findRelatedPRs(pullRequests, start, end, incidentTitle);
      const relatedCommits = this.findRelatedCommits(commits, start, end, incidentTitle);
      const contributorStats = this.buildContributorStats(relatedPRs, relatedCommits, contributors);

      const timeline = this.buildTimeline(pullRequests, commits, start, end);

      const duration = this.calculateDuration(start, end);

      const prompt = this.buildPrompt(
        request,
        relatedPRs,
        relatedCommits,
        contributorStats,
        timeline,
        duration,
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
          incidentDetails: {
            title: incidentTitle,
            severity,
            startDate,
            endDate,
            duration,
            status: 'resolved',
          },
          ...parsed,
          relatedPullRequests: relatedPRs,
          relatedCommits: relatedCommits,
          contributors: contributorStats,
          timeline: parsed.timeline.length > 0 ? parsed.timeline : timeline,
          generatedAt: new Date().toISOString(),
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
          message: `Failed to generate incident report: ${message}`,
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  private findRelatedPRs(
    pullRequests: Array<{
      number: number;
      title: string;
      user: string | null;
      state: string;
      html_url: string;
      created_at: string;
      merged_at?: string | null;
      body?: string | null;
    }>,
    start: Date,
    end: Date,
    incidentTitle: string,
  ): IncidentPR[] {
    const titleWords = incidentTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    return pullRequests
      .filter((pr) => {
        const prDate = new Date(pr.created_at);
        if (prDate < start || prDate > end) return false;
        const prTitle = pr.title.toLowerCase();
        const prBody = (pr.body || '').toLowerCase();
        return titleWords.some((w) => prTitle.includes(w) || prBody.includes(w));
      })
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        author: pr.user || 'unknown',
        state: pr.state,
        url: pr.html_url,
        mergedAt: pr.merged_at || undefined,
        relatedToIncident: true,
        confidence: this.calculateConfidence(pr.title, pr.body || '', incidentTitle),
      }))
      .slice(0, 10);
  }

  private findRelatedCommits(
    commits: Array<{
      sha: string;
      message: string;
      author: string | null;
      author_date: string;
      html_url: string;
    }>,
    start: Date,
    end: Date,
    incidentTitle: string,
  ): IncidentCommit[] {
    const titleWords = incidentTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    return commits
      .filter((commit) => {
        const commitDate = new Date(commit.author_date);
        if (commitDate < start || commitDate > end) return false;
        const commitMsg = commit.message.toLowerCase();
        return titleWords.some((w) => commitMsg.includes(w));
      })
      .map((commit) => ({
        sha: commit.sha.slice(0, 7),
        message: commit.message.split('\n')[0],
        author: commit.author || 'unknown',
        date: commit.author_date,
        url: commit.html_url,
        relatedToIncident: true,
        confidence: this.calculateConfidence(commit.message, '', incidentTitle),
      }))
      .slice(0, 10);
  }

  private calculateConfidence(
    text: string,
    body: string,
    incidentTitle: string,
  ): 'high' | 'medium' | 'low' {
    const titleWords = incidentTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const combined = `${text} ${body}`.toLowerCase();
    const matches = titleWords.filter((w) => combined.includes(w)).length;
    const ratio = matches / titleWords.length;
    if (ratio >= 0.7) return 'high';
    if (ratio >= 0.4) return 'medium';
    return 'low';
  }

  private buildContributorStats(
    pullRequests: Array<{ author: string }>,
    commits: Array<{ author: string }>,
    contributors: Array<{ login: string; avatar_url: string; contributions: number }>,
  ): IncidentContributor[] {
    const statsMap = new Map<string, IncidentContributor>();

    for (const c of contributors) {
      statsMap.set(c.login, {
        login: c.login,
        avatar_url: c.avatar_url,
        role: 'affected',
        contributions: 0,
      });
    }

    for (const pr of pullRequests) {
      const s = statsMap.get(pr.author);
      if (s) {
        s.role = 'fixer';
        s.contributions++;
      }
    }

    for (const commit of commits) {
      if (commit.author) {
        const s = statsMap.get(commit.author);
        if (s) {
          s.role = 'fixer';
          s.contributions++;
        }
      }
    }

    return Array.from(statsMap.values())
      .filter((s) => s.contributions > 0)
      .sort((a, b) => b.contributions - a.contributions);
  }

  private buildTimeline(
    pullRequests: Array<{
      created_at: string;
      merged_at?: string | null;
      title: string;
      user: string | null;
    }>,
    commits: Array<{ author_date: string; message: string; author: string | null }>,
    start: Date,
    end: Date,
  ): IncidentTimelineEvent[] {
    const events: IncidentTimelineEvent[] = [];

    events.push({ timestamp: start.toISOString(), event: 'Incident detected', type: 'detection' });

    for (const pr of pullRequests) {
      if (new Date(pr.created_at) >= start && new Date(pr.created_at) <= end) {
        events.push({
          timestamp: pr.created_at,
          event: `PR opened: ${pr.title}`,
          actor: pr.user || undefined,
          type: 'fix',
        });
      }
      if (pr.merged_at && new Date(pr.merged_at) >= start && new Date(pr.merged_at) <= end) {
        events.push({
          timestamp: pr.merged_at,
          event: `PR merged: ${pr.title}`,
          actor: pr.user || undefined,
          type: 'resolution',
        });
      }
    }

    for (const commit of commits) {
      if (new Date(commit.author_date) >= start && new Date(commit.author_date) <= end) {
        events.push({
          timestamp: commit.author_date,
          event: `Commit: ${commit.message.split('\n')[0]}`,
          actor: commit.author || undefined,
          type: 'fix',
        });
      }
    }

    events.push({ timestamp: end.toISOString(), event: 'Incident resolved', type: 'resolution' });

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private calculateDuration(start: Date, end: Date): string {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  private buildPrompt(
    request: IncidentSummaryRequest,
    relatedPRs: IncidentPR[],
    relatedCommits: IncidentCommit[],
    contributors: IncidentContributor[],
    timeline: IncidentTimelineEvent[],
    duration: string,
  ) {
    const prSummary = relatedPRs
      .map((pr) => `- #${pr.number} "${pr.title}" by ${pr.author} [${pr.state}]`)
      .join('\n');
    const commitSummary = relatedCommits
      .map((c) => `- ${c.sha} "${c.message}" by ${c.author}`)
      .join('\n');
    const contributorSummary = contributors
      .map((c) => `- ${c.login}: ${c.role} (${c.contributions} contributions)`)
      .join('\n');
    const timelineSummary = timeline
      .map((t) => `- ${new Date(t.timestamp).toISOString()}: ${t.event}`)
      .join('\n');

    const systemPrompt = `You are an expert Incident Response Manager generating a professional incident report.
Analyze the provided data and generate a comprehensive incident report.
IMPORTANT: Clearly distinguish between confirmed facts and AI inferences.
When presenting root cause analysis, always indicate confidence level and whether it's confirmed or inferred.
Format your response as valid JSON matching the required structure.`;

    const userPrompt = `Generate an incident report for: "${request.incidentTitle}"
Severity: ${request.severity}
Repository: ${request.owner}/${request.repo} (branch: ${request.branch})
Incident Period: ${request.startDate} to ${request.endDate} (${duration})
${request.description ? `Description: ${request.description}` : ''}

## Related Pull Requests
${prSummary || 'No directly related PRs found'}

## Related Commits
${commitSummary || 'No directly related commits found'}

## Contributors
${contributorSummary || 'No contributor data'}

## Timeline
${timelineSummary || 'No timeline data'}

Respond with JSON in this exact format:
{
  "executiveSummary": "1-2 paragraph executive summary clearly stating what is confirmed vs inferred",
  "impactAssessment": {
    "affectedUsers": "Description of affected users",
    "affectedServices": ["service1", "service2"],
    "duration": "${duration}",
    "severity": "${request.severity}",
    "businessImpact": "Business impact description"
  },
  "rootCause": {
    "summary": "Root cause analysis with clear confidence indicator",
    "isConfirmed": false,
    "confidence": "low|medium|high",
    "contributingFactors": ["factor1", "factor2"]
  },
  "resolutionSummary": "Summary of how the incident was resolved",
  "actionItems": [
    { "title": "Action item", "description": "Description", "priority": "high|medium|low", "category": "immediate|short-term|long-term" }
  ],
  "preventiveRecommendations": [
    { "title": "Recommendation", "description": "Description", "category": "monitoring|process|architecture|testing", "priority": "high|medium|low" }
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
        impactAssessment: parsed.impactAssessment || {
          affectedUsers: 'Unknown',
          affectedServices: [],
          duration: 'Unknown',
          severity: 'P2',
          businessImpact: 'Unknown',
        },
        rootCause: parsed.rootCause || {
          summary: 'Unable to determine',
          isConfirmed: false,
          confidence: 'low',
          contributingFactors: [],
        },
        resolutionSummary: parsed.resolutionSummary || 'Resolution details not available',
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        preventiveRecommendations: Array.isArray(parsed.preventiveRecommendations)
          ? parsed.preventiveRecommendations
          : [],
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
      };
    } catch {
      return {
        executiveSummary: response.slice(0, 2000),
        impactAssessment: {
          affectedUsers: 'Unknown',
          affectedServices: [],
          duration: 'Unknown',
          severity: 'P2',
          businessImpact: 'Unknown',
        },
        rootCause: {
          summary: 'Unable to determine from available data',
          isConfirmed: false,
          confidence: 'low',
          contributingFactors: [],
        },
        resolutionSummary: 'Resolution details not available',
        actionItems: [],
        preventiveRecommendations: [],
        timeline: [],
      };
    }
  }
}

export const incidentSummaryService = new IncidentSummaryService();
