import type {
  AIProvider,
  AIProviderName,
  AIProviderConfig,
  AIRequest,
  AIResponse,
  AIStreamChunk,
} from '@devpilot/ai-providers';
import { DEFAULT_RETRY_POLICY } from '@devpilot/ai-providers';
import type { RetryPolicy } from '@devpilot/ai-providers';
import { ProviderFactory } from './factory';
import { executeWithRetry } from './retry';
import { RequestLogger } from './logger';
import { AIGatewayError, createProviderNotInitializedError } from './errors';
import type { GatewayConfig, HealthStatus, ProviderStatus } from './types';
import { DEFAULT_GATEWAY_CONFIG } from './types';

export class GatewayService {
  private factory: ProviderFactory;
  private config: GatewayConfig;
  private logger: RequestLogger;
  private providerStats: Map<
    AIProviderName,
    { requestCount: number; errorCount: number; totalLatencyMs: number }
  > = new Map();

  constructor(config: Partial<GatewayConfig> = {}) {
    this.factory = new ProviderFactory();
    this.config = { ...DEFAULT_GATEWAY_CONFIG, ...config };
    this.logger = new RequestLogger();
  }

  registerProvider(name: AIProviderName, providerConfig: AIProviderConfig): AIProvider {
    return this.factory.createAndInitialize(name, providerConfig);
  }

  getProvider(name: AIProviderName): AIProvider | undefined {
    return this.factory.getProvider(name);
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const providerName = request.provider ?? this.config.defaultProvider;
    const provider = this.factory.getProvider(providerName);

    if (!provider) {
      throw new AIGatewayError(createProviderNotInitializedError(providerName));
    }

    if (!provider.isAvailable()) {
      throw new AIGatewayError(createProviderNotInitializedError(providerName));
    }

    const mergedRetryPolicy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...this.config,
      ...request.retryPolicy,
      maxAttempts: request.retryPolicy?.maxAttempts ?? this.config.globalRetryMaxAttempts,
    };

    let lastAttempt = 0;

    try {
      const response = await executeWithRetry(async (attempt) => {
        lastAttempt = attempt;
        const timeout = request.timeout ?? this.config.globalTimeout;

        return Promise.race([
          provider.generate(request),
          this.createTimeoutError<AIResponse>(timeout, providerName),
        ]);
      }, mergedRetryPolicy);

      this.recordSuccess(providerName, response.latencyMs);

      if (this.config.enableRequestLogging) {
        this.logger.log({
          id: this.generateLogId(),
          provider: providerName,
          model: response.model,
          timestamp: new Date(),
          latencyMs: response.latencyMs,
          success: true,
          tokensInput: response.tokens.input,
          tokensOutput: response.tokens.output,
          costTotal: response.cost.totalCost,
          retryAttempt: lastAttempt > 1 ? lastAttempt : undefined,
        });
      }

      return response;
    } catch (error) {
      this.recordError(providerName);

      let aiError: AIGatewayError;
      if (error instanceof AIGatewayError) {
        aiError = error;
      } else if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        const structured = error as {
          code: string;
          message: string;
          retryable?: boolean;
          statusCode?: number;
          provider?: AIProviderName;
        };
        aiError = new AIGatewayError({
          code: structured.code as never,
          message: structured.message,
          provider: structured.provider ?? providerName,
          statusCode: structured.statusCode,
          retryable: structured.retryable ?? false,
        });
      } else {
        aiError = new AIGatewayError({
          code: 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          provider: providerName,
          retryable: false,
        });
      }

      if (this.config.enableRequestLogging) {
        this.logger.log({
          id: this.generateLogId(),
          provider: providerName,
          model: request.model ?? 'unknown',
          timestamp: new Date(),
          latencyMs: 0,
          success: false,
          tokensInput: 0,
          tokensOutput: 0,
          costTotal: 0,
          errorCode: aiError.code,
          retryAttempt: lastAttempt > 1 ? lastAttempt : undefined,
        });
      }

      throw aiError;
    }
  }

  async *generateStream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const providerName = request.provider ?? this.config.defaultProvider;
    const provider = this.factory.getProvider(providerName);

    if (!provider) {
      throw new AIGatewayError(createProviderNotInitializedError(providerName));
    }

    if (!provider.isAvailable()) {
      throw new AIGatewayError(createProviderNotInitializedError(providerName));
    }

    if (!provider.generateStream) {
      const response = await provider.generate(request);
      const tokens = response.content.split(' ');
      for (let i = 0; i < tokens.length; i++) {
        yield { type: 'token', content: (i === 0 ? '' : ' ') + tokens[i] };
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      yield {
        type: 'metadata',
        provider: response.provider,
        model: response.model,
        tokens: response.tokens,
        latencyMs: response.latencyMs,
      };
      return;
    }

    try {
      const stream = provider.generateStream(request);

      for await (const chunk of stream) {
        yield chunk;
      }
    } catch (error) {
      yield {
        type: 'error',
        error: {
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : String(error),
          provider: providerName,
          retryable: false,
        },
      };
    }
  }

  async generateWithFallback(
    request: AIRequest,
    fallbackProviders: AIProviderName[] = [],
  ): Promise<AIResponse> {
    const providers = [request.provider ?? this.config.defaultProvider, ...fallbackProviders];

    for (const providerName of providers) {
      const provider = this.factory.getProvider(providerName);
      if (!provider || !provider.isAvailable()) continue;

      try {
        return await this.generate({ ...request, provider: providerName });
      } catch (error) {
        if (error instanceof AIGatewayError && !error.retryable) {
          continue;
        }
        throw error;
      }
    }

    throw new AIGatewayError({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'All providers are unavailable',
      retryable: false,
    });
  }

  async healthCheck(): Promise<HealthStatus> {
    const allNames = this.factory.getAllProviderNames();
    const statuses: Record<string, ProviderStatus> = {};

    for (const name of allNames) {
      const provider = this.factory.getProvider(name);
      const stats = this.providerStats.get(name) ?? {
        requestCount: 0,
        errorCount: 0,
        totalLatencyMs: 0,
      };

      let healthy = false;
      if (provider?.isAvailable()) {
        try {
          healthy = await provider.healthCheck();
        } catch {
          healthy = false;
        }
      }

      statuses[name] = {
        provider: name,
        initialized: provider?.isAvailable() ?? false,
        healthy,
        lastHealthCheck: healthy ? new Date() : null,
        ...stats,
      };
    }

    const allHealthy = Object.values(statuses).every((s) => !s.initialized || s.healthy);

    return {
      healthy: allHealthy,
      providers: statuses as HealthStatus['providers'],
      timestamp: new Date(),
    };
  }

  getAvailableProviders(): AIProviderName[] {
    return this.factory.getAvailableProviders();
  }

  getRequestLogs(count?: number) {
    return this.logger.getRecent(count);
  }

  getRequestStats() {
    return this.logger.getStats();
  }

  private recordSuccess(provider: AIProviderName, latencyMs: number): void {
    const stats = this.providerStats.get(provider) ?? {
      requestCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
    };
    stats.requestCount++;
    stats.totalLatencyMs += latencyMs;
    this.providerStats.set(provider, stats);
  }

  private recordError(provider: AIProviderName): void {
    const stats = this.providerStats.get(provider) ?? {
      requestCount: 0,
      errorCount: 0,
      totalLatencyMs: 0,
    };
    stats.errorCount++;
    this.providerStats.set(provider, stats);
  }

  private createTimeoutError<T>(ms: number, provider: AIProviderName): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new AIGatewayError({
            code: 'TIMEOUT',
            message: `Request to '${provider}' timed out after ${ms}ms`,
            provider,
            retryable: true,
          }),
        );
      }, ms);
    });
  }

  private generateLogId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
