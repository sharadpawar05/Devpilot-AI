import type {
  AIProviderName,
  AIModel,
  AIRequest,
  AIResponse,
  AIProviderConfig,
  RetryPolicy,
} from '@devpilot/ai-providers';
import { GatewayService } from './gateway';
import { AIGatewayError } from './errors';
import type { GatewayConfig, HealthStatus } from './types';

export interface GenerateOptions {
  provider?: AIProviderName;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  responseFormat?: 'text' | 'json';
  retryPolicy?: Partial<RetryPolicy>;
}

export interface StructuredJSONOptions extends GenerateOptions {
  schema?: Record<string, unknown>;
}

export class AIService {
  private gateway: GatewayService;

  constructor(config?: Partial<GatewayConfig>) {
    this.gateway = new GatewayService(config);
  }

  registerProvider(name: AIProviderName, config: AIProviderConfig): void {
    this.gateway.registerProvider(name, config);
  }

  async generate(
    prompt: string,
    systemPrompt: string | undefined,
    options: GenerateOptions = {},
  ): Promise<AIResponse> {
    const request: AIRequest = {
      prompt,
      systemPrompt,
      model: options.model,
      provider: options.provider,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      timeout: options.timeout,
      responseFormat: options.responseFormat,
      retryPolicy: options.retryPolicy,
    };

    return this.gateway.generate(request);
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options: GenerateOptions = {},
  ): Promise<string> {
    const response = await this.generate(prompt, systemPrompt, options);
    return response.content;
  }

  async generateStructuredJSON<T = Record<string, unknown>>(
    prompt: string,
    systemPrompt: string | undefined,
    options: StructuredJSONOptions = {},
  ): Promise<T> {
    const response = await this.generate(prompt, systemPrompt, {
      ...options,
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response.content) as T;
    } catch {
      throw new AIGatewayError({
        code: 'INVALID_REQUEST',
        message: 'Failed to parse structured JSON response',
        provider: response.provider,
        retryable: false,
      });
    }
  }

  async generateWithFallback(
    prompt: string,
    systemPrompt: string | undefined,
    fallbackProviders: AIProviderName[] = [],
    options: GenerateOptions = {},
  ): Promise<AIResponse> {
    const request: AIRequest = {
      prompt,
      systemPrompt,
      model: options.model,
      provider: options.provider,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      timeout: options.timeout,
      responseFormat: options.responseFormat,
      retryPolicy: options.retryPolicy,
    };

    return this.gateway.generateWithFallback(request, fallbackProviders);
  }

  async healthCheck(): Promise<HealthStatus> {
    return this.gateway.healthCheck();
  }

  getAvailableProviders(): AIProviderName[] {
    return this.gateway.getAvailableProviders();
  }

  getRequestStats() {
    return this.gateway.getRequestStats();
  }

  getRequestLogs(count?: number) {
    return this.gateway.getRequestLogs(count);
  }
}
