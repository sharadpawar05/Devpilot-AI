export type AIProvider = 'openai' | 'anthropic';

export type AIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku';

export interface AIGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
}

export interface AIGenerationResponse {
  content: string;
  model: AIModel;
  provider: AIProvider;
  tokensUsed: {
    input: number;
    output: number;
  };
  cost: number;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: AIModel;
  maxRetries?: number;
  timeout?: number;
}
