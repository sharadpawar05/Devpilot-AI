export type PromptCategory =
  | 'sprint_summary'
  | 'pr_summary'
  | 'release_notes'
  | 'status_report'
  | 'incident_summary'
  | 'code_analysis'
  | 'code_review'
  | 'debugging'
  | 'explanation'
  | 'testing'
  | 'documentation'
  | 'security'
  | 'performance'
  | 'architecture'
  | 'general';

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
  default?: unknown;
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

export interface PromptMetadata {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  tags: string[];
  version: number;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: PromptMetadata;
  renderedAt: Date;
  cacheKey: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  variable: string;
  message: string;
  code: 'MISSING_REQUIRED' | 'TYPE_MISMATCH' | 'EMPTY_VALUE' | 'UNKNOWN_VARIABLE';
}

export interface ValidationWarning {
  variable: string;
  message: string;
  code: 'DEFAULT_USED' | 'DEPRECATED_VARIABLE' | 'UNUSED_VARIABLE';
}

export interface CacheEntry {
  key: string;
  rendered: RenderedPrompt;
  hitCount: number;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface PromptEngineConfig {
  cacheMaxSize: number;
  cacheTtlMs: number;
  strictValidation: boolean;
  allowUnknownVariables: boolean;
}
