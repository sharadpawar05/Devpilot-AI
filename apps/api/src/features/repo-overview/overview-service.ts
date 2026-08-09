import { repositoryIntelligenceService } from '@/features/repo-intelligence';
import type {
  RepoOverviewMetadata,
  RepoFileNode,
  RepoLanguageBreakdown,
  RepoContributor,
  RepoOverviewData,
  RepoHealthDetail,
  HealthQualityMetrics,
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
    category: string;
    status: string;
    passed: boolean;
    severity: string;
    failedDescription: string;
    whyItMatters: string;
    recommendation: string;
    estimatedEffort: string;
    actionLabel: string;
    actionType: string;
    scorePenalty: number;
    quality?: HealthQualityMetrics;
  }>,
): RepoHealthDetail[] {
  return details.map((d) => ({
    name: d.name,
    category: d.category as RepoHealthDetail['category'],
    status: d.status as RepoHealthDetail['status'],
    passed: d.passed,
    severity: d.severity as RepoHealthDetail['severity'],
    failedDescription: d.failedDescription,
    whyItMatters: d.whyItMatters,
    recommendation: d.recommendation,
    estimatedEffort: d.estimatedEffort,
    actionLabel: d.actionLabel,
    actionType: d.actionType as RepoHealthDetail['actionType'],
    scorePenalty: d.scorePenalty,
    quality: d.quality,
  }));
}

export class RepoOverviewService {
  async getOverview(userId: string, owner: string, repo: string): Promise<RepoOverviewData> {
    const [metadataResult, languagesResult, contributorsResult, treeResult, healthResult] =
      await Promise.allSettled([
        repositoryIntelligenceService.getMetadata(userId, owner, repo),
        repositoryIntelligenceService.getLanguages(userId, owner, repo),
        repositoryIntelligenceService.getContributors(userId, owner, repo),
        repositoryIntelligenceService.getFileTree(userId, owner, repo),
        repositoryIntelligenceService.getHealth(userId, owner, repo),
      ]);

    if (metadataResult.status === 'rejected') {
      throw new Error(
        `Failed to fetch repository metadata: ${metadataResult.reason instanceof Error ? metadataResult.reason.message : 'Unknown error'}`,
      );
    }

    const metadata = metadataResult.value;
    const languages =
      languagesResult.status === 'fulfilled'
        ? languagesResult.value
        : ({} as RepoLanguageBreakdown);
    const contributors = contributorsResult.status === 'fulfilled' ? contributorsResult.value : [];
    const tree = treeResult.status === 'fulfilled' ? treeResult.value : [];
    const health =
      healthResult.status === 'fulfilled'
        ? healthResult.value
        : {
            score: 0,
            passedCount: 0,
            failedCount: 0,
            criticalCount: 0,
            details: [],
            scoreBreakdown: [],
            summary: {
              structuralScore: 0,
              qualityScore: 0,
              structuralWeight: 40,
              qualityWeight: 60,
            },
          };

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
        summary: health.summary,
      },
      totalFiles,
      totalDirectories,
    };
  }
}

export const repoOverviewService = new RepoOverviewService();
