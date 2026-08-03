import { WorkflowType, type WorkflowConfig } from '../types';

export const playgroundConfig: WorkflowConfig = {
  workflowType: WorkflowType.PLAYGROUND,
  defaultMaxTokens: 2048,
  defaultTemperature: 0.7,
  contextBuilder: (ctx) => ctx,
};

export const codeReviewConfig: WorkflowConfig = {
  workflowType: WorkflowType.CODE_REVIEW,
  promptTemplateId: 'prompt_code_review',
  defaultMaxTokens: 2048,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const prReviewConfig: WorkflowConfig = {
  workflowType: WorkflowType.PR_REVIEW,
  promptTemplateId: 'prompt_code_review',
  defaultMaxTokens: 2048,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const prAnalysisConfig: WorkflowConfig = {
  workflowType: WorkflowType.PR_ANALYSIS,
  promptTemplateId: 'prompt_pr_assistant',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const repositoryChatConfig: WorkflowConfig = {
  workflowType: WorkflowType.REPOSITORY_CHAT,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const documentationConfig: WorkflowConfig = {
  workflowType: WorkflowType.DOCUMENTATION,
  promptTemplateId: 'prompt_readme_generator',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.5,
  contextBuilder: (ctx) => ctx,
};

export const testGenerationConfig: WorkflowConfig = {
  workflowType: WorkflowType.TEST_GENERATION,
  promptTemplateId: 'prompt_generate_tests',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const securityReviewConfig: WorkflowConfig = {
  workflowType: WorkflowType.SECURITY_REVIEW,
  promptTemplateId: 'prompt_security_review',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.2,
  contextBuilder: (ctx) => ctx,
};

export const architectureReviewConfig: WorkflowConfig = {
  workflowType: WorkflowType.ARCHITECTURE_REVIEW,
  promptTemplateId: 'prompt_architecture_review',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.3,
  contextBuilder: (ctx) => ctx,
};

export const codeFixConfig: WorkflowConfig = {
  workflowType: WorkflowType.CODE_FIX,
  promptTemplateId: 'prompt_fix_code',
  defaultMaxTokens: 4096,
  defaultTemperature: 0.1,
  contextBuilder: (ctx) => ctx,
};

export const workflowConfigs: Record<WorkflowType, WorkflowConfig> = {
  [WorkflowType.PLAYGROUND]: playgroundConfig,
  [WorkflowType.CODE_REVIEW]: codeReviewConfig,
  [WorkflowType.CODE_FIX]: codeFixConfig,
  [WorkflowType.PR_REVIEW]: prReviewConfig,
  [WorkflowType.PR_ANALYSIS]: prAnalysisConfig,
  [WorkflowType.REPOSITORY_CHAT]: repositoryChatConfig,
  [WorkflowType.DOCUMENTATION]: documentationConfig,
  [WorkflowType.TEST_GENERATION]: testGenerationConfig,
  [WorkflowType.SECURITY_REVIEW]: securityReviewConfig,
  [WorkflowType.ARCHITECTURE_REVIEW]: architectureReviewConfig,
};

export function getWorkflowConfig(workflowType: WorkflowType): WorkflowConfig {
  return workflowConfigs[workflowType];
}
