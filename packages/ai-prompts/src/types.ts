export type PromptCategory = 'sprint_summary' | 'pr_summary' | 'release_notes' | 'status_report' | 'incident_summary';

export interface PromptTemplate {
  id: string;
  name: string;
  category: PromptCategory;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: PromptVariable[];
  temperature: number;
  maxTokens: number;
  version: number;
}

export interface PromptVariable {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array';
}

export interface CompiledPrompt {
  systemPrompt: string;
  userPrompt: string;
  variables: Record<string, unknown>;
  metadata: {
    templateId: string;
    templateVersion: number;
    compiledAt: Date;
  };
}
