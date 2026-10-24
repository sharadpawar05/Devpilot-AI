import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = {
  user: { findUnique: vi.fn() },
  userSettings: { findUnique: vi.fn() },
};

vi.mock('@/core/db', () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => db.user.findUnique(...args) },
    userSettings: { findUnique: (...args: unknown[]) => db.userSettings.findUnique(...args) },
  },
}));

import { resolveAIRequestDefaults, getAIUserPrefs } from '@/features/settings/ai-prefs';

const savedSettings = {
  userId: 'user-1',
  defaultProvider: 'groq',
  defaultModel: 'qwen/qwen3.8-27b',
  temperature: 0.2,
  maxTokens: 8192,
  defaultReviewType: 'deep',
};

describe('resolveAIRequestDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.userSettings.findUnique.mockResolvedValue(savedSettings);
  });

  it('fills omitted fields from saved preferences', async () => {
    const merged = await resolveAIRequestDefaults('supa-1', { code: 'x', language: 'ts' });
    expect(merged.provider).toBe('groq');
    expect(merged.model).toBe('qwen/qwen3.8-27b');
    expect(merged.temperature).toBe(0.2);
    expect(merged.maxTokens).toBe(8192);
    // deep → Deep
    expect(merged.reviewDepth).toBe('Deep');
  });

  it('never overrides explicitly provided fields', async () => {
    const merged = await resolveAIRequestDefaults('supa-1', {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 1.5,
      reviewDepth: 'Quick',
    });
    expect(merged.provider).toBe('openai');
    expect(merged.model).toBe('gpt-4o');
    expect(merged.temperature).toBe(1.5);
    expect(merged.reviewDepth).toBe('Quick');
    // maxTokens still omitted → filled from settings.
    expect(merged.maxTokens).toBe(8192);
  });

  it('short-circuits without a DB hit when every injectable field is present', async () => {
    const merged = await resolveAIRequestDefaults('supa-1', {
      provider: 'gemini',
      model: 'm',
      temperature: 0.5,
      maxTokens: 1000,
      reviewDepth: 'Standard',
    });
    expect(merged.provider).toBe('gemini');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns the original body when the user has no settings row', async () => {
    db.userSettings.findUnique.mockResolvedValue(null);
    const body = { code: 'x', language: 'ts' };
    const merged = await resolveAIRequestDefaults('supa-1', body);
    expect(merged).toEqual(body);
  });

  it('fails soft on a DB error', async () => {
    db.user.findUnique.mockRejectedValue(new Error('db down'));
    const body = { code: 'x' };
    const merged = await resolveAIRequestDefaults('supa-1', body);
    expect(merged).toEqual(body);
  });

  it('maps quick/standard/deep review types onto Quick/Standard/Deep depths', async () => {
    for (const [ui, server] of [
      ['quick', 'Quick'],
      ['standard', 'Standard'],
      ['deep', 'Deep'],
    ] as const) {
      db.userSettings.findUnique.mockResolvedValue({ ...savedSettings, defaultReviewType: ui });
      const merged = await resolveAIRequestDefaults('supa-1', { reviewDepth: undefined });
      expect(merged.reviewDepth).toBe(server);
    }
  });
});

describe('getAIUserPrefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty object for a user with no settings', async () => {
    db.userSettings.findUnique.mockResolvedValue(null);
    expect(await getAIUserPrefs('user-1')).toEqual({});
  });
});
