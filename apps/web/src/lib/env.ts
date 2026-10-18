import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY is required'),
  VITE_API_URL: z.string().min(1).default('/api/v1'),
});

function loadEnv() {
  const result = envSchema.safeParse(import.meta.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');
    // Fail fast: continuing with empty values crashes later inside
    // supabase-js with a far less helpful error.
    throw new Error(
      `Invalid environment variables:\n${messages}\n\n` +
        `Set these in Vercel Dashboard → Settings → Environment Variables ` +
        `(or apps/web/.env.local for local development).`,
    );
  }

  return result.data;
}

export const env = loadEnv();
