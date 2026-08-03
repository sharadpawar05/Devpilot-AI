import type { AIResponse } from '@devpilot/ai-providers';
import type { WorkflowType, WorkflowResponse, WorkflowError } from './types';

export function parseResponse(
  raw: AIResponse | null,
  workflowType: WorkflowType,
  error: WorkflowError | null,
): WorkflowResponse {
  if (error || !raw) {
    return {
      success: false,
      workflowType,
      provider: (error?.provider || 'gemini') as never,
      model: 'unknown' as never,
      latencyMs: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      formattedResponse: '',
      rawResponse: '',
      timestamp: new Date().toISOString(),
      error: error || { code: 'NO_RESPONSE', message: 'No response received from AI service.' },
    };
  }

  return {
    success: true,
    workflowType,
    provider: raw.provider,
    model: raw.model,
    latencyMs: raw.latencyMs,
    tokenUsage: raw.tokens,
    formattedResponse: raw.content,
    rawResponse: raw.content,
    timestamp: new Date().toISOString(),
  };
}
