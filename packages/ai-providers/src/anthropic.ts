import type {
  AIProvider,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  ProviderCapabilities,
  AIProviderName,
  AIModel,
} from './types';

const ANTHROPIC_MODELS: AIModel[] = [
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-3.5-sonnet',
];

export class AnthropicProvider implements AIProvider {
  readonly name: AIProviderName = 'anthropic';

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
      message: 'Anthropic provider is scaffolded but not yet implemented',
      provider: 'anthropic' as AIProviderName,
      retryable: false,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      provider: 'anthropic',
      models: ANTHROPIC_MODELS,
      supportsStreaming: true,
      supportsJsonMode: false,
      maxContextLength: 200000,
      costPer1kInputTokens: 0.015,
      costPer1kOutputTokens: 0.075,
      rateLimitRpm: 400,
    };
  }

  isAvailable(): boolean {
    return this.available && this.config !== null;
  }

  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }

  private createNotInitializedError(): Error {
    return new Error('AnthropicProvider not initialized. Call initialize() first.');
  }
}
