import type {
  AIProvider,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  ProviderCapabilities,
  AIProviderName,
  AIModel,
} from './types';

const OPENAI_MODELS: AIModel[] = ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'];

export class OpenAIProvider implements AIProvider {
  readonly name: AIProviderName = 'openai';

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
      message: 'OpenAI provider is scaffolded but not yet implemented',
      provider: 'openai' as AIProviderName,
      retryable: false,
    };
  }

  getCapabilities(): ProviderCapabilities {
    return {
      provider: 'openai',
      models: OPENAI_MODELS,
      supportsStreaming: true,
      supportsJsonMode: true,
      maxContextLength: 128000,
      costPer1kInputTokens: 0.03,
      costPer1kOutputTokens: 0.06,
      rateLimitRpm: 500,
    };
  }

  isAvailable(): boolean {
    return this.available && this.config !== null;
  }

  async healthCheck(): Promise<boolean> {
    return this.isAvailable();
  }

  private createNotInitializedError(): Error {
    return new Error('OpenAIProvider not initialized. Call initialize() first.');
  }
}
