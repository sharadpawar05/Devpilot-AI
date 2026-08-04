import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import type {
  RepoOverviewMetadata,
  RepoFileNode,
  RepoLanguageBreakdown,
  RepoContributor,
  RepoOverviewData,
  RepoHealthDetail,
} from './types';

function countNodes(tree: RepoFileNode[]): { files: number; directories: number } {
  let files = 0;
  let directories = 0;
  function walk(nodes: RepoFileNode[]) {
    for (const node of nodes) {
      if (node.type === 'dir') {
        directories++;
        if (node.children) walk(node.children);
      } else {
        files++;
      }
    }
  }
  walk(tree);
  return { files, directories };
}

function mapHealthDetails(
  details: Array<{
    name: string;
    passed: boolean;
    severity: string;
    failedDescription: string;
    whyItMatters: string;
    recommendation: string;
    estimatedEffort: string;
    actionLabel: string;
    actionType: string;
    scorePenalty: number;
  }>,
): RepoHealthDetail[] {
  return details.map((d) => ({
    name: d.name,
    passed: d.passed,
    severity: d.severity as 'critical' | 'high' | 'medium' | 'low',
    failedDescription: d.failedDescription,
    whyItMatters: d.whyItMatters,
    recommendation: d.recommendation,
    estimatedEffort: d.estimatedEffort,
    actionLabel: d.actionLabel,
    actionType: d.actionType as RepoHealthDetail['actionType'],
    scorePenalty: d.scorePenalty,
  }));
}

export class RepoOverviewService {
  async getOverview(userId: string, owner: string, repo: string): Promise<RepoOverviewData> {
    const [metadata, languages, contributors, tree, health] = await Promise.all([
      repositoryIntelligenceService.getMetadata(userId, owner, repo),
      repositoryIntelligenceService.getLanguages(userId, owner, repo),
      repositoryIntelligenceService.getContributors(userId, owner, repo),
      repositoryIntelligenceService.getFileTree(userId, owner, repo),
      repositoryIntelligenceService.getHealth(userId, owner, repo),
    ]);

    const overviewMetadata: RepoOverviewMetadata = {
      id: metadata.id,
      name: metadata.name,
      full_name: metadata.full_name,
      description: metadata.description,
      html_url: metadata.html_url,
      default_branch: metadata.default_branch,
      visibility: metadata.visibility,
      size: metadata.size,
      stargazers_count: metadata.stargazers_count,
      forks_count: metadata.forks_count,
      open_issues_count: metadata.open_issues_count,
      watchers_count: metadata.watchers_count,
      language: metadata.language,
      license: metadata.license,
      topics: metadata.topics,
      created_at: metadata.created_at,
      updated_at: metadata.updated_at,
      pushed_at: metadata.pushed_at,
      owner: metadata.owner,
    };

    // Convert FileTreeNode[] to RepoFileNode[]
    const mappedTree: RepoFileNode[] = tree.map((node) => ({
      path: node.path,
      name: node.name,
      type: node.type as 'file' | 'dir',
      size: node.size,
      children: node.children?.map((child) => ({
        path: child.path,
        name: child.name,
        type: child.type as 'file' | 'dir',
        size: child.size,
      })),
    }));

    const { files: totalFiles, directories: totalDirectories } = countNodes(mappedTree);

    const contributorList: RepoContributor[] = contributors.map((c) => ({
      login: c.login,
      avatar_url: c.avatar_url,
      contributions: c.contributions,
    }));

    return {
      metadata: overviewMetadata,
      tree: mappedTree,
      languages: languages as RepoLanguageBreakdown,
      contributors: contributorList,
      health: {
        score: health.score,
        passedCount: health.passedCount,
        failedCount: health.failedCount,
        criticalCount: health.criticalCount,
        details: mapHealthDetails(health.details),
        scoreBreakdown: health.scoreBreakdown,
      },
      totalFiles,
      totalDirectories,
    };
  }
}

export const repoOverviewService = new RepoOverviewService();
