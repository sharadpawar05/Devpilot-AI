export type AIProviderName = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export type AIModel =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.0-flash'
  | 'gemini-flash-latest'
  | 'gemini-3.5-flash'
  | 'gemini-3.6-flash'
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-3.5-sonnet';

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  model?: AIModel;
  provider?: AIProviderName;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'text' | 'json';
  retryPolicy?: Partial<RetryPolicy>;
}

export interface AIResponse {
  content: string;
  model: AIModel;
  provider: AIProviderName;
  tokens: TokenUsage;
  cost: CostBreakdown;
  latencyMs: number;
  metadata?: Record<string, unknown>;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: AIModel;
  maxRetries?: number;
  timeout?: number;
}

export interface ProviderCapabilities {
  provider: AIProviderName;
  models: AIModel[];
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  maxContextLength: number;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  rateLimitRpm?: number;
}

export type AIErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_REQUEST'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN_ERROR';

export interface AIError {
  code: AIErrorCode;
  message: string;
  provider?: AIProviderName;
  statusCode?: number;
  retryable: boolean;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

export interface AIProvider {
  readonly name: AIProviderName;

  initialize(config: AIProviderConfig): void;
  generate(request: AIRequest): Promise<AIResponse>;
  getCapabilities(): ProviderCapabilities;
  isAvailable(): boolean;
  healthCheck(): Promise<boolean>;
}
