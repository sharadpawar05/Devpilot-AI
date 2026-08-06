import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';
import { WorkflowType } from './types';

let sharedRegistry: PromptRegistry | null = null;

function getRegistry(): PromptRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new PromptRegistry();
    sharedRegistry.registerAll(loadMarkdownPrompts());
  }
  return sharedRegistry;
}

const workflowPromptMap: Record<WorkflowType, string | null> = {
  [WorkflowType.PLAYGROUND]: null,
  [WorkflowType.CODE_REVIEW]: 'prompt_code_review',
  [WorkflowType.CODE_FIX]: 'prompt_fix_code',
  [WorkflowType.PR_REVIEW]: 'prompt_code_review',
  [WorkflowType.PR_ANALYSIS]: 'prompt_pr_assistant',
  [WorkflowType.REPOSITORY_CHAT]: null, // Uses custom prompts
  [WorkflowType.DOCUMENTATION]: 'prompt_readme_generator',
  [WorkflowType.TEST_GENERATION]: 'prompt_generate_tests',
  [WorkflowType.SECURITY_REVIEW]: 'prompt_security_review',
  [WorkflowType.ARCHITECTURE_REVIEW]: 'prompt_architecture_review',
};

const REVIEW_TYPE_PROMPT_MAP: Record<string, string> = {
  Performance: 'prompt_performance_review',
  Security: 'prompt_security_review',
  Architecture: 'prompt_architecture_review',
};

export interface PromptResult {
  systemPrompt: string | undefined;
  userPrompt: string;
}

export function buildPrompt(
  workflowType: WorkflowType,
  context: Record<string, unknown>,
  rawPrompt?: string,
): PromptResult {
  if (workflowType === WorkflowType.PLAYGROUND) {
    return {
      systemPrompt: undefined,
      userPrompt: rawPrompt || '',
    };
  }

  let templateId = workflowPromptMap[workflowType];

  if (workflowType === WorkflowType.CODE_REVIEW) {
    const reviewType = (context.reviewType as string) || 'Standard';
    templateId = REVIEW_TYPE_PROMPT_MAP[reviewType] || templateId;
  }

  if (!templateId) {
    return {
      systemPrompt: undefined,
      userPrompt: rawPrompt || JSON.stringify(context),
    };
  }

  const registry = getRegistry();
  const rendered = registry.render(templateId, context);

  return {
    systemPrompt: rendered.systemPrompt || undefined,
    userPrompt: rendered.userPrompt,
  };
}

export function getPromptTemplateId(workflowType: WorkflowType): string | null {
  return workflowPromptMap[workflowType] ?? null;
}
