import type { AIError, AIProviderName } from '@devpilot/ai-providers';

export class AIGatewayError extends Error implements AIError {
  readonly code: AIError['code'];
  readonly provider?: AIProviderName;
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(error: AIError) {
    super(error.message);
    this.name = 'AIGatewayError';
    this.code = error.code;
    this.provider = error.provider;
    this.statusCode = error.statusCode;
    this.retryable = error.retryable;
  }

  toJSON(): AIError {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}

export function createProviderNotInitializedError(provider: AIProviderName): AIError {
  return {
    code: 'PROVIDER_UNAVAILABLE',
    message: `Provider '${provider}' is not initialized`,
    provider,
    retryable: false,
  };
}

export function createTimeoutError(provider: AIProviderName, timeoutMs: number): AIError {
  return {
    code: 'TIMEOUT',
    message: `Request to '${provider}' timed out after ${timeoutMs}ms`,
    provider,
    retryable: true,
  };
}

export function createNetworkError(provider: AIProviderName, cause: unknown): AIError {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    code: 'NETWORK_ERROR',
    message: `Network error communicating with '${provider}': ${message}`,
    provider,
    retryable: true,
  };
}
