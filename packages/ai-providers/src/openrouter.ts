import type {
  AIProvider,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  ProviderCapabilities,
  AIProviderName,
  AIModel,
} from './types';

const OPENROUTER_MODELS: AIModel[] = [
  'gpt-4',
  'gpt-4-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
];

export class OpenRouterProvider implements AIProvider {
  readonly name: AIProviderName = 'openrouter';

  private config: AIProviderConfig | null = null;
  private available = false;

  initialize(config: AIProviderConfig): void {
    this.config = config;
    this.available = true;
  }

  async generate(_request: AIRequest): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw this.createNotInitializedError();
    }

    throw {
      code: 'NOT_IMPLEMENTED',
      message: 'OpenRouter provider is scaffolded but not yet implemented',
      provider: 'openrouter' as AIProviderName,
      retryable: false,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      provider: 'openrouter',
      models: OPENROUTER_MODELS,
      supportsStreaming: true,
      supportsJsonMode: false,
      maxContextLength: 200000,
      costPer1kInputTokens: 0.01,
      costPer1kOutputTokens: 0.03,
      rateLimitRpm: 200,
    };
  }

  isAvailable(): boolean {
    return this.available && this.config !== null;
  }

  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }

  private createNotInitializedError(): Error {
    return new Error('OpenRouterProvider not initialized. Call initialize() first.');
  }
}
