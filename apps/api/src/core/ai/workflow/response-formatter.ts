import { WorkflowType, type ResponseFormatterFn } from './types';

const formatters = new Map<WorkflowType, ResponseFormatterFn>();

export function registerResponseFormatter(
  workflowType: WorkflowType,
  formatter: ResponseFormatterFn,
): void {
  formatters.set(workflowType, formatter);
}

export function formatResponse(
  workflowType: WorkflowType,
  rawResponse: string,
  context: Record<string, unknown>,
): string {
  const formatter = formatters.get(workflowType);
  if (!formatter) {
    return rawResponse;
  }
  return formatter(rawResponse, context);
}

// Default formatters

registerResponseFormatter(WorkflowType.PLAYGROUND, (raw) => raw);

registerResponseFormatter(WorkflowType.CODE_REVIEW, (raw) => raw);

registerResponseFormatter(WorkflowType.PR_REVIEW, (raw) => raw);

registerResponseFormatter(WorkflowType.PR_ANALYSIS, (raw) => raw);

registerResponseFormatter(WorkflowType.REPOSITORY_CHAT, (raw) => raw);

registerResponseFormatter(WorkflowType.DOCUMENTATION, (raw) => raw);

registerResponseFormatter(WorkflowType.TEST_GENERATION, (raw) => raw);

registerResponseFormatter(WorkflowType.SECURITY_REVIEW, (raw) => raw);

registerResponseFormatter(WorkflowType.ARCHITECTURE_REVIEW, (raw) => raw);
