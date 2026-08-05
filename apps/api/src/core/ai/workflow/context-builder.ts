import { WorkflowType, type ContextBuilderFn } from './types';

const CODE_FENCE_LANGUAGE_MAP: Record<string, string> = {
  react: 'tsx',
  nodejs: 'javascript',
};

const contextBuilders = new Map<WorkflowType, ContextBuilderFn>();

export function registerContextBuilder(
  workflowType: WorkflowType,
  builder: ContextBuilderFn,
): void {
  contextBuilders.set(workflowType, builder);
}

export function getContextBuilder(workflowType: WorkflowType): ContextBuilderFn | undefined {
  return contextBuilders.get(workflowType);
}

export async function buildContext(
  workflowType: WorkflowType,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const builder = contextBuilders.get(workflowType);
  if (!builder) {
    return { ...context };
  }
  const enriched = await builder(context);
  return { ...context, ...enriched };
}

// Default context builders for each workflow type

registerContextBuilder(WorkflowType.PLAYGROUND, (ctx) => ({
  ...ctx,
}));

registerContextBuilder(WorkflowType.CODE_REVIEW, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const codeFenceLanguage = CODE_FENCE_LANGUAGE_MAP[language] || language;
  const code = (ctx.code as string) || '';
  const reviewType = (ctx.reviewType as string) || 'Standard';
  const reviewDepth = (ctx.reviewDepth as string) || 'Standard';
  const contextStr = (ctx.context as string) || '';

  return {
    language: codeFenceLanguage,
    code,
    reviewType,
    reviewDepth,
    ...(contextStr ? { context: contextStr } : {}),
    isQuick: reviewDepth === 'Quick' ? 'yes' : undefined,
    isStandard: reviewDepth === 'Standard' ? 'yes' : undefined,
    isDeep: reviewDepth === 'Deep' ? 'yes' : undefined,
  };
});

registerContextBuilder(WorkflowType.PR_REVIEW, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const diff = (ctx.diff as string) || '';
  const reviewType = (ctx.reviewType as string) || 'Standard';
  const reviewDepth = (ctx.reviewDepth as string) || 'Standard';
  const prTitle = (ctx.prTitle as string) || '';
  const prBody = (ctx.prBody as string) || '';
  const prAuthor = (ctx.prAuthor as string) || 'unknown';
  const additions = (ctx.additions as number) || 0;
  const deletions = (ctx.deletions as number) || 0;
  const filesChanged = (ctx.filesChanged as number) || 0;

  const prContext = [
    `PR: ${prTitle}`,
    prBody ? `Description: ${prBody}` : '',
    `Author: ${prAuthor}`,
    `Files changed: ${filesChanged}`,
    `+${additions} -${deletions}`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    language,
    code: diff,
    context: prContext,
    reviewType,
    reviewDepth,
    isQuick: reviewDepth === 'Quick' ? 'yes' : undefined,
    isStandard: reviewDepth === 'Standard' ? 'yes' : undefined,
    isDeep: reviewDepth === 'Deep' ? 'yes' : undefined,
  };
});

registerContextBuilder(WorkflowType.PR_ANALYSIS, (ctx) => {
  const title = (ctx.title as string) || '';
  const body = (ctx.body as string) || '(No description provided)';
  const author = (ctx.author as string) || 'unknown';
  const baseBranch = (ctx.baseBranch as string) || 'main';
  const headBranch = (ctx.headBranch as string) || 'feature';
  const additions = String(ctx.additions ?? 0);
  const deletions = String(ctx.deletions ?? 0);
  const changedFiles = String(ctx.changedFiles ?? 0);
  const diff = (ctx.diff as string) || '';
  const fileTypes = (ctx.fileTypes as string) || 'mixed';
  const truncated = (ctx.truncated as boolean) || false;

  return {
    title,
    body,
    author,
    baseBranch,
    headBranch,
    additions,
    deletions,
    changedFiles,
    diff,
    fileTypes,
    truncated: truncated ? 'yes' : undefined,
  };
});

registerContextBuilder(WorkflowType.REPOSITORY_CHAT, (ctx) => {
  const treeSummary = (ctx.treeSummary as string) || '';
  const relevantCode = (ctx.relevantCode as string) || '';
  const conversationHistory = (ctx.conversationHistory as string) || '';
  const question = (ctx.question as string) || '';

  return {
    treeSummary,
    relevantCode,
    conversationHistory,
    question,
  };
});

registerContextBuilder(WorkflowType.DOCUMENTATION, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const code = (ctx.code as string) || '';
  const fileName = (ctx.fileName as string) || '';

  return { language, code, fileName };
});

registerContextBuilder(WorkflowType.TEST_GENERATION, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const code = (ctx.code as string) || '';
  const coverageGoals = (ctx.coverageGoals as string) || 'comprehensive';
  const framework = (ctx.framework as string) || '';

  return { language, code, coverageGoals, framework };
});

registerContextBuilder(WorkflowType.SECURITY_REVIEW, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const code = (ctx.code as string) || '';
  const contextStr = (ctx.context as string) || '';

  return { language, code, context: contextStr };
});

registerContextBuilder(WorkflowType.ARCHITECTURE_REVIEW, (ctx) => {
  const language = (ctx.language as string) || 'unknown';
  const code = (ctx.code as string) || '';
  const contextStr = (ctx.context as string) || '';
  const projectStructure = (ctx.projectStructure as string) || '';

  return { language, code, context: contextStr, projectStructure };
});
