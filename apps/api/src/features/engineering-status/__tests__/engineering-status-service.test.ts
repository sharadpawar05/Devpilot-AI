import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/repo-intelligence', () => ({
  repositoryIntelligenceService: {
    getPullRequests: vi.fn().mockResolvedValue([]),
    getCommits: vi.fn().mockResolvedValue([]),
    getContributors: vi.fn().mockResolvedValue([]),
    getIssues: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/core/ai/service', () => ({
  aiService: {
    generate: vi.fn(),
  },
}));

import { engineeringStatusService } from '../engineering-status-service';
import { aiService } from '@/core/ai/service';

const GEMINI_429 = `[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent: [429 Too Many Requests] You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. * Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash Please retry in 31.182946158s. [{"@type":"type.googleapis.com/google.rpc.Help"}]`;

const request = {
  owner: 'vercel',
  repo: 'next.js',
  branch: 'main',
  timeRange: '14d' as const,
};

describe('EngineeringStatusService.generateReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes Gemini 429 errors without leaking raw provider text', async () => {
    vi.mocked(aiService.generate).mockRejectedValue(new Error(GEMINI_429));

    const result = await engineeringStatusService.generateReport('user-1', request);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(result.error?.message).toBe(
      'Rate limit exceeded. Please wait 32 seconds and try again.',
    );
    expect(result.error?.retryable).toBe(true);
    expect(result.error?.message).not.toContain('GoogleGenerativeAI');
    expect(result.error?.message).not.toContain('429');
    expect(result.error?.message).not.toContain('generativelanguage.googleapis.com');
    expect(result.error?.message).not.toContain('{');
  });

  it('returns a sanitized generic failure for non-rate-limit AI errors', async () => {
    vi.mocked(aiService.generate).mockRejectedValue(
      new Error(
        '[GoogleGenerativeAI Error]: [500 Internal Server Error] https://example.com {json}',
      ),
    );

    const result = await engineeringStatusService.generateReport('user-1', request);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('AI_ERROR');
    expect(result.error?.message).not.toContain('GoogleGenerativeAI');
    expect(result.error?.message).not.toContain('https://');
    expect(result.error?.message).toContain('Failed to generate report.');
  });
});
