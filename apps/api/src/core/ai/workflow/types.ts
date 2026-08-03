import type { AIProviderName, AIModel, TokenUsage } from '@devpilot/ai-providers';

export enum WorkflowType {
  PLAYGROUND = 'PLAYGROUND',
  CODE_REVIEW = 'CODE_REVIEW',
  CODE_FIX = 'CODE_FIX',
  PR_REVIEW = 'PR_REVIEW',
  PR_ANALYSIS = 'PR_ANALYSIS',
  REPOSITORY_CHAT = 'REPOSITORY_CHAT',
  DOCUMENTATION = 'DOCUMENTATION',
  TEST_GENERATION = 'TEST_GENERATION',
  SECURITY_REVIEW = 'SECURITY_REVIEW',
  ARCHITECTURE_REVIEW = 'ARCHITECTURE_REVIEW',
}

export interface WorkflowRequest {
  workflowType: WorkflowType;
  provider: AIProviderName;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  context: Record<string, unknown>;
  prompt?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowResponse {
  success: boolean;
  workflowType: WorkflowType;
  provider: AIProviderName;
  model: AIModel;
  latencyMs: number;
  tokenUsage: TokenUsage;
  formattedResponse: string;
  rawResponse: string;
  timestamp: string;
  error?: WorkflowError;
}

export interface WorkflowError {
  code: string;
  message: string;
  provider?: AIProviderName;
  retryable?: boolean;
}

export interface WorkflowConfig {
  workflowType: WorkflowType;
  promptTemplateId?: string;
  defaultMaxTokens: number;
  defaultTemperature: number;
  contextBuilder: ContextBuilderFn;
  responseFormatter?: ResponseFormatterFn;
}

export type ContextBuilderFn = (
  context: Record<string, unknown>,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type ResponseFormatterFn = (rawResponse: string, context: Record<string, unknown>) => string;

export interface WorkflowHistoryEntry {
  id: string;
  workflowType: WorkflowType;
  provider: AIProviderName;
  model: AIModel;
  latencyMs: number;
  tokenUsage: TokenUsage;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  totalTokens: number;
  byWorkflowType: Record<WorkflowType, WorkflowTypeMetrics>;
  byProvider: Record<AIProviderName, ProviderMetrics>;
}

export interface WorkflowTypeMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  totalTokens: number;
}

export interface ProviderMetrics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  totalTokens: number;
}
