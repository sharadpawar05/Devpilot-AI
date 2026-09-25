import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import { aiService } from '@/core/ai/service';
import type {
  ReleaseNotesRequest,
  ReleaseNotesResponse,
  ReleaseNotesData,
  ReleaseContributor,
  ReleaseTag,
} from './types';

const DEFAULT_MODEL = 'gemini-3.6-flash';

export class ReleaseNotesService {
  async generateReleaseNotes(
    userId: string,
    request: ReleaseNotesRequest,
  ): Promise<ReleaseNotesResponse> {
    const startTime = Date.now();
    const {
      owner,
      repo,
      previousTag,
      currentTag,
      startDate,
      endDate,
      provider = 'gemini',
    } = request;

    try {
      const releases = await repositoryIntelligenceService.getReleases(userId, owner, repo, 50);

      let releaseDateRange = this.getDateRangeFromTags(releases, previousTag, currentTag);

      if (!releaseDateRange && startDate && endDate) {
        releaseDateRange = {
          start: new Date(startDate),
          end: new Date(endDate),
        };
      }

      if (!releaseDateRange) {
        releaseDateRange = {
          start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          end: new Date(),
        };
      }

      const [pullRequests, commits, contributors] = await Promise.all([
        repositoryIntelligenceService.getPullRequests(userId, owner, repo, 'all', 200),
        repositoryIntelligenceService.getCommits(userId, owner, repo, 'main', 200),
        repositoryIntelligenceService.getContributors(userId, owner, repo, 50),
      ]);

      const filteredPRs = pullRequests.filter((pr) => {
        const prDate = new Date(pr.updated_at);
        return prDate >= releaseDateRange!.start && prDate <= releaseDateRange!.end;
      });

      const filteredCommits = commits.filter((commit) => {
        const commitDate = new Date(commit.author_date);
        return commitDate >= releaseDateRange!.start && commitDate <= releaseDateRange!.end;
      });

      const mergedPRs = filteredPRs.filter((pr) => pr.merged || pr.state === 'closed');

      const contributorStats = this.buildContributorStats(mergedPRs, filteredCommits, contributors);

      const releaseVersion = currentTag || this.generateVersion(releases);
      const releaseDate = currentTag
        ? releases.find((r) => r.tag_name === currentTag)?.published_at || new Date().toISOString()
        : new Date().toISOString();

      const prompt = this.buildPrompt(
        request,
        mergedPRs,
        filteredCommits,
        contributorStats,
        releaseVersion,
        releaseDateRange,
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
          releaseVersion,
          releaseDate,
          ...parsed,
          contributors: contributorStats,
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
          message: `Failed to generate release notes: ${message}`,
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async getReleaseTags(userId: string, owner: string, repo: string): Promise<ReleaseTag[]> {
    const releases = await repositoryIntelligenceService.getReleases(userId, owner, repo, 50);
    return releases
      .filter((r) => !r.draft)
      .map((r) => ({
        name: r.tag_name,
        commitSha: r.tag_name,
        date: r.published_at || r.created_at,
      }));
  }

  private getDateRangeFromTags(
    releases: Array<{ tag_name: string; published_at: string | null; created_at: string }>,
    previousTag?: string,
    currentTag?: string,
  ): { start: Date; end: Date } | null {
    if (!currentTag) return null;

    const currentRelease = releases.find((r) => r.tag_name === currentTag);
    if (!currentRelease) return null;

    const end = new Date(currentRelease.published_at || currentRelease.created_at);

    let start: Date;
    if (previousTag) {
      const previousRelease = releases.find((r) => r.tag_name === previousTag);
      if (previousRelease) {
        start = new Date(previousRelease.published_at || previousRelease.created_at);
      } else {
        start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
      }
    } else {
      const currentIndex = releases.findIndex((r) => r.tag_name === currentTag);
      if (currentIndex < releases.length - 1) {
        const prevRelease = releases[currentIndex + 1];
        start = new Date(prevRelease.published_at || prevRelease.created_at);
      } else {
        start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
      }
    }

    return { start, end };
  }

  private generateVersion(releases: Array<{ tag_name: string }>): string {
    if (releases.length === 0) return 'v1.0.0';

    const latestTag = releases[0]?.tag_name || 'v0.0.0';
    const match = latestTag.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) return 'v1.0.0';

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    return `v${major}.${minor + 1}.0`;
  }

  private buildContributorStats(
    pullRequests: Array<{ user: string | null }>,
    commits: Array<{ author: string | null }>,
    contributors: Array<{ login: string; avatar_url: string; contributions: number }>,
  ): ReleaseContributor[] {
    const statsMap = new Map<string, ReleaseContributor>();

    for (const contributor of contributors) {
      statsMap.set(contributor.login, {
        login: contributor.login,
        avatar_url: contributor.avatar_url,
        contributions: contributor.contributions,
        prCount: 0,
        commitCount: 0,
      });
    }

    for (const pr of pullRequests) {
      if (pr.user) {
        const stats = statsMap.get(pr.user);
        if (stats) stats.prCount++;
      }
    }

    for (const commit of commits) {
      if (commit.author) {
        const stats = statsMap.get(commit.author);
        if (stats) stats.commitCount++;
      }
    }

    return Array.from(statsMap.values())
      .filter((s) => s.prCount > 0 || s.commitCount > 0)
      .sort((a, b) => b.prCount + b.commitCount - (a.prCount + a.commitCount));
  }

  private buildPrompt(
    request: ReleaseNotesRequest,
    pullRequests: Array<{
      title: string;
      user: string | null;
      body: string | null;
      labels?: string[];
    }>,
    commits: Array<{ message: string; author: string | null }>,
    contributors: ReleaseContributor[],
    releaseVersion: string,
    dateRange: { start: Date; end: Date },
  ) {
    const prSummary = pullRequests
      .slice(0, 50)
      .map(
        (pr) =>
          `- "${pr.title}" by ${pr.user || 'unknown'}${pr.body ? ` - ${pr.body.slice(0, 100)}` : ''}`,
      )
      .join('\n');

    const commitSummary = commits
      .slice(0, 50)
      .map((c) => `- ${c.message.split('\n')[0]} by ${c.author || 'unknown'}`)
      .join('\n');

    const contributorSummary = contributors
      .slice(0, 20)
      .map((c) => `- ${c.login}: ${c.prCount} PRs, ${c.commitCount} commits`)
      .join('\n');

    const systemPrompt = `You are an expert technical writer generating professional release notes.
Analyze the provided repository activity and generate comprehensive release notes.
Be specific, data-driven, and focus on user-facing changes.
Format your response as valid JSON matching the required structure.`;

    const userPrompt = `Generate release notes for version ${releaseVersion}
Repository: ${request.owner}/${request.repo}
Period: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]}

## Pull Requests (${pullRequests.length} total)
${prSummary || 'No pull requests in this period'}

## Commits (${commits.length} total)
${commitSummary || 'No commits in this period'}

## Contributors
${contributorSummary || 'No contributor data'}

Respond with JSON in this exact format:
{
  "executiveSummary": "1-2 paragraph overview of this release",
  "newFeatures": [
    { "title": "Feature name", "description": "Description", "prNumber": 123, "author": "username" }
  ],
  "bugFixes": [
    { "title": "Fix name", "description": "Description", "prNumber": 123, "author": "username" }
  ],
  "improvements": [
    { "title": "Improvement name", "description": "Description", "prNumber": 123, "author": "username" }
  ],
  "breakingChanges": [
    { "title": "Breaking change", "description": "Description and migration path", "prNumber": 123, "author": "username" }
  ],
  "knownIssues": [
    { "title": "Issue title", "description": "Description and workaround" }
  ],
  "upgradeNotes": [
    "Step-by-step upgrade instructions"
  ],
  "aiSummary": "Brief technical summary for developers"
}`;

    return { systemPrompt, userPrompt };
  }

  private parseAIResponse(
    response: string,
  ): Omit<ReleaseNotesData, 'releaseVersion' | 'releaseDate' | 'contributors'> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        executiveSummary: parsed.executiveSummary || response.slice(0, 1000),
        newFeatures: Array.isArray(parsed.newFeatures) ? parsed.newFeatures : [],
        bugFixes: Array.isArray(parsed.bugFixes) ? parsed.bugFixes : [],
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        breakingChanges: Array.isArray(parsed.breakingChanges) ? parsed.breakingChanges : [],
        knownIssues: Array.isArray(parsed.knownIssues) ? parsed.knownIssues : [],
        upgradeNotes: Array.isArray(parsed.upgradeNotes) ? parsed.upgradeNotes : [],
        aiSummary: parsed.aiSummary || '',
      };
    } catch {
      return {
        executiveSummary: response.slice(0, 2000),
        newFeatures: [],
        bugFixes: [],
        improvements: [],
        breakingChanges: [],
        knownIssues: [],
        upgradeNotes: [],
        aiSummary: response.slice(0, 1000),
      };
    }
  }
}

export const releaseNotesService = new ReleaseNotesService();
