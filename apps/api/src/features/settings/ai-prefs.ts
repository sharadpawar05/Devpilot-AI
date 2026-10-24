import { db } from '@/core/db';

// The settings UI stores the review dimension as quick/standard/deep, which
// maps onto the AI routes' reviewDepth enum (Quick/Standard/Deep). The UI's
// separate "reviewDepth" (shallow/moderate/thorough) is a distinct
// thoroughness concept with no server counterpart, so it is persisted but not
// injected server-side. reviewType (Standard/Performance/Security/…) is a
// "what to focus on" axis with no settings equivalent, so it keeps its route
// default.
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

async function loadPrefs(supabaseUserId: string): Promise<AIUserPrefs | null> {
  try {
    const user = await db.user.findUnique({
      where: { supabaseUserId },
      select: { id: true },
    });
    if (!user) return null;
    const s = await db.userSettings.findUnique({ where: { userId: user.id } });
    if (!s) return null;
    return {
      provider: s.defaultProvider,
      model: s.defaultModel,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      reviewDepth: REVIEW_TYPE_TO_DEPTH[s.defaultReviewType] ?? undefined,
    };
  } catch {
    return null;
  }
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

/**
 * Fills any AI request fields the client left `undefined` with the user's
 * saved preferences, so the settings tab becomes the source of truth for
 * provider/model/temperature/maxTokens/reviewDepth when a caller omits them.
 * Explicitly-provided fields always win. Fails soft: on any error the original
 * body is returned unchanged and the route's own DEFAULT_MODELS apply.
 *
 * Injectable keys: provider, model, temperature, maxTokens, reviewDepth.
 */
export async function resolveAIRequestDefaults(
  supabaseUserId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const needs =
    body.provider === undefined ||
    body.model === undefined ||
    body.temperature === undefined ||
    body.maxTokens === undefined ||
    body.reviewDepth === undefined;
  if (!needs) return body;

  const prefs = await loadPrefs(supabaseUserId);
  if (!prefs) return body;

  const merged = { ...body };
  if (merged.provider === undefined && prefs.provider) merged.provider = prefs.provider;
  if (merged.model === undefined && prefs.model) merged.model = prefs.model;
  if (merged.temperature === undefined && prefs.temperature !== undefined) {
    merged.temperature = prefs.temperature;
  }
  if (merged.maxTokens === undefined && prefs.maxTokens !== undefined) {
    merged.maxTokens = prefs.maxTokens;
  }
  if (merged.reviewDepth === undefined && prefs.reviewDepth) {
    merged.reviewDepth = prefs.reviewDepth;
  }
  return merged;
}
