export type WorkflowType =
  'playground' | 'code-review' | 'pr-assistant' | 'repo-chat' | 'docs' | 'test-gen';

export type AIProviderName = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export type AIModel =
  | 'gemini-2.0-flash'
  | 'gemini-2.5-pro'
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
  'pr-assistant': 'PR Assistant',
  'repo-chat': 'Repository Chat',
  docs: 'Documentation',
  'test-gen': 'Test Generation',
};

export const WORKFLOW_TYPE_ICONS: Record<WorkflowType, string> = {
  playground: 'MessageSquare',
  'code-review': 'FileCode',
  'pr-assistant': 'GitPullRequest',
  'repo-chat': 'Repository',
  docs: 'BookOpen',
  'test-gen': 'FlaskConical',
};
