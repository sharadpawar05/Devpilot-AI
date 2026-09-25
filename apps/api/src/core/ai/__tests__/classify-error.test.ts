import { describe, it, expect } from 'vitest';
import { classifyAIError } from '@/core/ai/classify-error';

const GEMINI_429 = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash Please retry in 41.206410223s. [{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API quotas","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]}]`;

describe('classifyAIError', () => {
  it('classifies Gemini 429 quota errors without leaking raw provider text', () => {
    const result = classifyAIError(new Error(GEMINI_429));

    expect(result.status).toBe(429);
    expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.retryable).toBe(true);
    expect(result.message).toBe('Rate limit exceeded. Please wait 42 seconds and try again.');
    expect(result.message).not.toContain('GoogleGenerativeAI');
    expect(result.message).not.toContain('429');
    expect(result.message).not.toContain('generativelanguage.googleapis.com');
    expect(result.message).not.toContain('quotaValue');
    expect(result.message).not.toContain('{');
  });

  it('parses RetryInfo retryDelay without "retry in" phrasing', () => {
    const result = classifyAIError(new Error('429 RESOURCE_EXHAUSTED retryDelay: "33s" quota'));
    expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.message).toContain('33 seconds');
  });

  it('returns a generic rate-limit message when no delay is present', () => {
    const result = classifyAIError(new Error('Too Many Requests'));
    expect(result.status).toBe(429);
    expect(result.message).toBe('Rate limit exceeded. Please wait a moment and try again.');
  });

  it('cleans non-rate-limit provider errors', () => {
    const result = classifyAIError(
      new Error(
        '[GoogleGenerativeAI Error]: [500 Internal Server Error] https://example.com {json}',
      ),
    );
    expect(result.status).toBe(502);
    expect(result.code).toBe('AI_ERROR');
    expect(result.message).not.toContain('GoogleGenerativeAI');
    expect(result.message).not.toContain('https://');
  });

  it('classifies structured AIError codes without relying on message text', () => {
    const result = classifyAIError({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Groq rate limit exceeded. Please wait a moment and try again.',
      provider: 'groq',
      retryable: true,
    });
    expect(result.status).toBe(429);
    expect(result.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.retryable).toBe(true);
  });

  it('classifies PROVIDER_UNAVAILABLE structured errors', () => {
    const result = classifyAIError({
      code: 'PROVIDER_UNAVAILABLE',
      message: "Provider 'groq' is not initialized",
      provider: 'groq',
      retryable: false,
    });
    expect(result.status).toBe(503);
    expect(result.code).toBe('PROVIDER_UNAVAILABLE');
    expect(result.message).toContain('not configured');
  });

  it('classifies Groq request-too-large ITPM errors with an actionable message', () => {
    const result = classifyAIError({
      code: 'INVALID_REQUEST',
      message:
        'Request too large for model `qwen/qwen3.8-27b` in organization `org_01hqhgh7z1f0japnyajgaaj6vy` service tier `on_demand` on input tokens per minute (ITPM): Limit 7000, Requested 12636, please reduce your message size and try again. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com',
      provider: 'groq',
      statusCode: 413,
      retryable: false,
    });
    expect(result.status).toBe(413);
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.retryable).toBe(false);
    expect(result.message).toBe(
      'The request is too large for this AI provider. Try reviewing fewer files or a different provider.',
    );
    expect(result.message).not.toContain('ITPM');
    expect(result.message).not.toContain('org_01');
    expect(result.message).not.toContain('qwen');
  });

  it('classifies unstructured request-too-large messages as 413', () => {
    const result = classifyAIError(
      new Error('Request too large for model x on input tokens per minute (ITPM): Limit 7000'),
    );
    expect(result.status).toBe(413);
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.retryable).toBe(false);
    expect(result.message).toContain('too large');
  });
});
