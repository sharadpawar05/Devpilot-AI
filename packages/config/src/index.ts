import { z } from 'zod';

// Re-export AI model configuration
export * from './ai-models';

const envSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  API_URL: z.string().default('http://localhost:3001'),
  WEB_PORT: z.coerce.number().default(3000),
  WEB_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/engineering_ai'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  GEMINI_API_KEY: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  AI_DEFAULT_MODEL: z.string().default('gemini-2.5-flash'),
  AI_MAX_TOKENS: z.coerce.number().default(4096),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => {
        const errors = (value as { _errors?: string[] })._errors;
        return errors?.length ? `${key}: ${errors.join(', ')}` : null;
      })
      .filter(Boolean);

    if (errors.length > 0) {
      console.warn(`[config] Environment validation warnings:\n  ${errors.join('\n  ')}`);
    }
  }

  cachedEnv = result.success ? result.data : envSchema.parse({});
  return cachedEnv;
}

export function getEnv(): Env {
  return loadEnv();
}

export const config = {
  api: {
    get port() {
      return getEnv().API_PORT;
    },
    get url() {
      return getEnv().API_URL;
    },
  },
  web: {
    get port() {
      return getEnv().WEB_PORT;
    },
    get url() {
      return getEnv().WEB_URL;
    },
  },
  database: {
    get url() {
      return getEnv().DATABASE_URL;
    },
  },
  redis: {
    get url() {
      return getEnv().REDIS_URL;
    },
  },
  auth: {
    get supabaseUrl() {
      return getEnv().SUPABASE_URL;
    },
    get supabaseAnonKey() {
      return getEnv().SUPABASE_ANON_KEY;
    },
    get supabaseServiceRoleKey() {
      return getEnv().SUPABASE_SERVICE_ROLE_KEY;
    },
  },
  ai: {
    get geminiApiKey() {
      return getEnv().GEMINI_API_KEY;
    },
    get openaiApiKey() {
      return getEnv().OPENAI_API_KEY;
    },
    get anthropicApiKey() {
      return getEnv().ANTHROPIC_API_KEY;
    },
    get openrouterApiKey() {
      return getEnv().OPENROUTER_API_KEY;
    },
    get defaultModel() {
      return getEnv().AI_DEFAULT_MODEL;
    },
    get maxTokens() {
      return getEnv().AI_MAX_TOKENS;
    },
  },
} as const;

export { envSchema };
