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
});
