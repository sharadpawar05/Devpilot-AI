import { z } from 'zod';

// Browsers report the canonical IANA zone (e.g. Asia/Kolkata) while some
// server ICU builds only list legacy aliases (Asia/Calcutta) in
// supportedValuesOf. The authoritative check is whether Intl can construct a
// formatter for the zone — that accepts both canonical and legacy names and
// rejects anything invalid.
function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const AI_PROVIDERS = ['gemini', 'openai', 'anthropic', 'openrouter', 'groq'] as const;
export const REVIEW_TYPES_UI = ['quick', 'standard', 'deep'] as const;
export const REVIEW_DEPTHS_UI = ['shallow', 'moderate', 'thorough'] as const;
export const THEMES = ['light', 'dark', 'system'] as const;
export const FONT_SIZES = ['small', 'default', 'large'] as const;
export const ACCENT_COLORS = ['blue', 'purple', 'green', 'orange', 'pink'] as const;

const timezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((tz) => isValidTimezone(tz), { message: 'Unsupported timezone' });

export const profilePatchSchema = z
  .object({
    // Full name is user-editable (updates User.fullName). Email is NOT
    // accepted: it is owned by the OAuth provider (Google/GitHub) and is
    // surfaced read-only in the UI.
    name: z.string().trim().min(1, 'Name is required').max(100).optional(),
    timezone: timezoneSchema,
  })
  .strict();

export const aiPatchSchema = z
  .object({
    defaultProvider: z.enum(AI_PROVIDERS),
    defaultModel: z.string().min(1).max(120),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(256).max(32768),
    streamResponses: z.boolean(),
    markdownOutput: z.boolean(),
    autoScroll: z.boolean(),
    autoCopy: z.boolean(),
    defaultReviewType: z.enum(REVIEW_TYPES_UI),
    defaultReviewDepth: z.enum(REVIEW_DEPTHS_UI),
  })
  .strict();

export const githubPatchSchema = z
  .object({
    defaultRepository: z.string().max(200).nullable(),
    defaultBranch: z.string().max(200).nullable(),
  })
  .strict();

export const appearancePatchSchema = z
  .object({
    theme: z.enum(THEMES),
    compactMode: z.boolean(),
    fontSize: z.enum(FONT_SIZES),
    accentColor: z.enum(ACCENT_COLORS),
  })
  .strict();

export const notificationsPatchSchema = z
  .object({
    notifyReviewComplete: z.boolean(),
    notifyPrAnalysis: z.boolean(),
    notifyRepositorySync: z.boolean(),
    notifyGithubAlerts: z.boolean(),
    notifyWeeklySummary: z.boolean(),
  })
  .strict();

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB decoded
const ALLOWED_AVATAR_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const avatarUploadSchema = z
  .object({
    dataUrl: z.string().refine((v) => /^data:(image\/(?:png|jpe?g|webp|gif));base64,/.test(v), {
      message: 'dataUrl must be a base64-encoded image (png, jpeg, webp, or gif)',
    }),
  })
  .strict();

export const accountDeleteSchema = z
  .object({
    // Client echoes the challenge id it received; the authoritative binding
    // (userId + pre-auth session_id) lives in a signed httpOnly cookie.
    confirm: z.literal(true),
  })
  .strict();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type AIPatch = z.infer<typeof aiPatchSchema>;
export type GitHubPatch = z.infer<typeof githubPatchSchema>;
export type AppearancePatch = z.infer<typeof appearancePatchSchema>;
export type NotificationsPatch = z.infer<typeof notificationsPatchSchema>;
export type AvatarUpload = z.infer<typeof avatarUploadSchema>;

export { MAX_AVATAR_BYTES, ALLOWED_AVATAR_MIMES };
