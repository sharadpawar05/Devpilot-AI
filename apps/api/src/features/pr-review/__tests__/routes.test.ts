import { describe, it, expect } from 'vitest';
import { diffLimitFor } from '@/features/pr-review/routes';

describe('diffLimitFor', () => {
  it('caps diffs for groq to fit the free-tier input token limit', () => {
    expect(diffLimitFor('groq')).toBe(16_000);
  });

  it('keeps the default diff limit for other providers', () => {
    expect(diffLimitFor('gemini')).toBe(100_000);
    expect(diffLimitFor('openai')).toBe(100_000);
    expect(diffLimitFor('anthropic')).toBe(100_000);
    expect(diffLimitFor('openrouter')).toBe(100_000);
  });
});
