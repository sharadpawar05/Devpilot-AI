import { db } from '@/core/db';

// Settings UI stores review "type" as quick/standard/deep, which maps onto the
// AI routes' review *depth* enum (Quick/Standard/Deep). The UI's reviewDepth
// (shallow/moderate/thorough) is a distinct thoroughness concept with no server
// counterpart, so it is persisted but not injected server-side.
const REVIEW_TYPE_TO_DEPTH: Record<string, string> = {
  quick: 'Quick',
  standard: 'Standard',
  deep: 'Deep',
};

export interface AIUserPrefs {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reviewDepth?: string;
}

/**
 * Loads a user's saved AI preferences for server-side default injection.
 * Returns an empty object when no settings row exists (fresh user) or on any
 * error, so callers can fall back to their built-in DEFAULT_MODELS safely.
 *
 * @param userId The *local* database user id (not the Supabase id).
 */
export async function getAIUserPrefs(userId: string): Promise<AIUserPrefs> {
  try {
    const s = await db.userSettings.findUnique({ where: { userId } });
    if (!s) return {};
    return {
      provider: s.defaultProvider,
      model: s.defaultModel,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      reviewDepth: REVIEW_TYPE_TO_DEPTH[s.defaultReviewType] ?? undefined,
    };
  } catch {
    return {};
  }
}
