export type WorkflowType =
  | 'playground'
  | 'code-review'
  | 'pr-review'
  | 'pr-analysis'
  | 'repository-chat'
  | 'documentation'
  | 'test-generation'
  | 'security-review'
  | 'architecture-review';

export type AIProviderName = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export type AIModel =
  | 'gemini-3.6-flash'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | 'anthropic/claude-sonnet-4'
  | 'anthropic/claude-3.5-haiku';

export interface AIHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  latency: number;
  tokens: number;
  timestamp: string;
}

export interface AIHistorySession {
  id: string;
  workflowType: WorkflowType;
  repository?: string;
  title: string;
  messages: AIHistoryMessage[];
  provider: AIProviderName;
  model: AIModel;
  totalLatency: number;
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
  favorite: boolean;
}

export interface AIHistorySessionMetadata {
  id: string;
  workflowType: WorkflowType;
  repository?: string;
  title: string;
  provider: AIProviderName;
  model: AIModel;
  totalLatency: number;
  totalTokens: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  archived: boolean;
  favorite: boolean;
}

export interface AIHistoryFilters {
  workflowType?: WorkflowType[];
  repository?: string[];
  provider?: AIProviderName[];
  dateFrom?: string;
  dateTo?: string;
  favorite?: boolean;
  pinned?: boolean;
  archived?: boolean;
  search?: string;
}

export interface AIHistoryPagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface AIHistoryListResult {
  sessions: AIHistorySessionMetadata[];
  pagination: AIHistoryPagination;
}

export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  playground: 'Playground',
  'code-review': 'Code Review',
  'pr-review': 'PR Review',
  'pr-analysis': 'PR Analysis',
  'repository-chat': 'Repository Chat',
  documentation: 'Documentation',
  'test-generation': 'Test Generation',
  'security-review': 'Security Review',
  'architecture-review': 'Architecture Review',
};

export const WORKFLOW_TYPE_ICONS: Record<WorkflowType, string> = {
  playground: 'MessageSquare',
  'code-review': 'FileCode',
  'pr-review': 'GitPullRequest',
  'pr-analysis': 'GitPullRequest',
  'repository-chat': 'Repository',
  documentation: 'BookOpen',
  'test-generation': 'FlaskConical',
  'security-review': 'Shield',
  'architecture-review': 'Layout',
};
