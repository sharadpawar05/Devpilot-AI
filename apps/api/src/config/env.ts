import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,https://devpilot-ai-phi.vercel.app'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  // Service-role key (server-only). Optional at boot so the app still starts
  // when avatar storage / account deletion are unconfigured; those routes
  // return a clear CONFIGURATION_ERROR instead.
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection string'),
  ENCRYPTION_SECRET: z.string().min(16, 'ENCRYPTION_SECRET must be at least 16 characters'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_REDIRECT_URI: z.string().default('http://localhost:3000/github'),
  GEMINI_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  GROAK_API_KEY: z.string().default(''),
  GROQ_API_KEY: z.string().default(''),
  AI_DEFAULT_MODEL: z.string().default('gemini-3.6-flash'),
  // Outbound AI call bounds (read by core/ai/concurrency.ts via process.env;
  // validated here so a malformed value fails fast at boot).
  AI_MAX_CONCURRENT: z.coerce.number().int().min(1).max(64).default(4),
  AI_MAX_QUEUE: z.coerce.number().int().min(0).max(1000).default(16),
  AI_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(100).max(300_000).default(30_000),
  AI_STREAM_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(60_000),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function loadEnv(): Env {
  if (env) return env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  env = result.data;
  return env;
}

export function getEnv(): Env {
  if (!env) {
    return loadEnv();
  }
  return env;
}
