export type UserID = string;
export type TeamID = string;
export type GenerationID = string;

export interface User {
  id: UserID;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: TeamID;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  userId: UserID;
  teamId: TeamID;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  createdAt: Date;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export {
  type AuthProvider,
  type Role,
  type AuthUser,
  type Session,
  type OAuthConfig,
  type AuthState,
} from './auth';

export {
  type WorkflowType,
  type AIProviderName,
  type AIModel,
  type AIHistoryMessage,
  type AIHistorySession,
  type AIHistorySessionMetadata,
  type AIHistoryFilters,
  type AIHistoryPagination,
  type AIHistoryListResult,
  WORKFLOW_TYPE_LABELS,
  WORKFLOW_TYPE_ICONS,
} from './ai-history';
