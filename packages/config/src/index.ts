export const config = {
  api: {
    port: Number(process.env.API_PORT) || 3001,
    url: process.env.API_URL || 'http://localhost:3001',
  },
  web: {
    port: Number(process.env.WEB_PORT) || 3000,
    url: process.env.WEB_URL || 'http://localhost:3000',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/engineering_ai',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  auth: {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-4',
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 4096,
  },
} as const;
