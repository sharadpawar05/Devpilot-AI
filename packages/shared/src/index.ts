import type { User, Team, TeamMember } from '@engineering-ai/types';

export type { User, Team, TeamMember };

export interface AuthContext {
  user: User | null;
  team: Team | null;
  teamMember: TeamMember | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface GenerationRequest {
  type: 'sprint_summary' | 'pr_summary' | 'release_notes' | 'status_report' | 'incident_summary';
  inputData: Record<string, unknown>;
  templateId?: string;
}

export interface GenerationResponse {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  inputData: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  createdAt: Date;
}
