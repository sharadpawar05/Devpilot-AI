import { aiService } from '@/core/ai/service';
import type { AIProviderName, AIModel, AIResponse } from '@devpilot/ai-providers';
import type { WorkflowRequest, WorkflowError } from './types';

export interface ExecutionResult {
  response: AIResponse | null;
  error: WorkflowError | null;
}

export async function executeRequest(
  userPrompt: string,
  systemPrompt: string | undefined,
  request: WorkflowRequest,
): Promise<ExecutionResult> {
  try {
    const result = await aiService.generate(userPrompt, systemPrompt, {
      provider: request.provider,
      model: request.model as AIModel | undefined,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    return { response: result, error: null };
  } catch (err) {
    const error = mapToWorkflowError(err, request.provider);
    return { response: null, error };
  }
}

function mapToWorkflowError(err: unknown, provider: AIProviderName): WorkflowError {
  if (err && typeof err === 'object' && 'code' in err) {
    const aiError = err as { code: string; message: string };
    const code = String(aiError.code);

    switch (code) {
      case 'AUTHENTICATION_ERROR':
        return {
          code: 'INVALID_API_KEY',
          message: `Invalid API key for ${provider}. Check your configuration.`,
          provider,
          retryable: false,
        };
      case 'RATE_LIMIT_EXCEEDED':
        return {
          code: 'RATE_LIMIT',
          message: `Rate limit exceeded for ${provider}. Try again later.`,
          provider,
          retryable: true,
        };
      case 'TIMEOUT':
        return {
          code: 'TIMEOUT',
          message: `Request to ${provider} timed out.`,
          provider,
          retryable: true,
        };
      case 'MODEL_NOT_FOUND':
        return {
          code: 'MODEL_NOT_FOUND',
          message: `Model not found for ${provider}.`,
          provider,
          retryable: false,
        };
      case 'CONTEXT_LENGTH_EXCEEDED':
        return {
          code: 'CONTEXT_LENGTH_EXCEEDED',
          message: `Input exceeds maximum context length for ${provider}.`,
          provider,
          retryable: false,
        };
      case 'NETWORK_ERROR':
        return {
          code: 'NETWORK_ERROR',
          message: `Network error communicating with ${provider}.`,
          provider,
          retryable: true,
        };
      case 'PROVIDER_UNAVAILABLE':
        return {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Provider ${provider} is currently unavailable.`,
          provider,
          retryable: true,
        };
      default:
        return {
          code: 'AI_ERROR',
          message: aiError.message || `AI request failed for ${provider}.`,
          provider,
          retryable: false,
        };
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    code: 'UNKNOWN_ERROR',
    message: message || 'An unknown error occurred.',
    provider,
    retryable: false,
  };
}
