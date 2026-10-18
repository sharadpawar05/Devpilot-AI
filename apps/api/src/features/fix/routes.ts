import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import { usageService, sendUsageLimitReached, AI_CREDIT_COSTS } from '@/core/usage';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

const LANGUAGE_PATTERN = /^[a-zA-Z0-9+#._-]{1,20}$/;

const fixRequestSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100000, 'Code too long'),
  language: z
    .string()
    .min(1, 'Language is required')
    .regex(LANGUAGE_PATTERN, 'Language must be a short alphanumeric identifier'),
  reviewContext: z.string().max(20000).optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
});

type FixRequest = z.infer<typeof fixRequestSchema>;

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
  groq: 'qwen/qwen3.8-27b',
};

export async function fixRoutes(app: FastifyInstance) {
  app.post<{
    Body: FixRequest;
  }>(
    '/ai/fix',
    {
      preHandler: [authenticate],
      config: {
        // AI fixes are expensive — tighter than the global ceiling.
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
      schema: {
        description: 'Generate structured code fixes with diffs and explanations',
        tags: ['ai', 'fix'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code', 'language'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 100000 },
            language: { type: 'string', minLength: 1, maxLength: 20 },
            reviewContext: { type: 'string', maxLength: 20000 },
            provider: {
              type: 'string',
              enum: ['gemini', 'openai', 'anthropic', 'openrouter', 'groq'],
            },
            model: { type: 'string', minLength: 1 },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            maxTokens: { type: 'number', minimum: 1, maximum: 100000 },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const parsed = fixRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { code, language, reviewContext, provider, model, temperature, maxTokens } =
        parsed.data;

      const availableProviders = aiService.getAvailableProviders();
      if (!availableProviders.includes(provider)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `Provider '${provider}' is not configured. Available: ${availableProviders.join(', ') || 'none'}.`,
          },
        });
      }

      let rendered;
      try {
        rendered = registry.render('prompt_fix_code', {
          language,
          code,
          reviewContext: reviewContext ?? '',
        });
      } catch (error) {
        app.log.error({ err: error }, 'Prompt rendering failed');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMPT_ERROR',
            message: 'Failed to render prompt',
          },
        });
      }

      const creditCost = AI_CREDIT_COSTS.CODE_FIX;
      const consume = await usageService.consumeQuota(auth.sub, 'AI_CREDITS', creditCost);
      if (!consume.allowed && consume.details) {
        return sendUsageLimitReached(reply, consume.details);
      }

      try {
        const result = await aiService.generate(rendered.userPrompt, rendered.systemPrompt, {
          provider,
          model: (model ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini) as never,
          temperature: temperature ?? 0.1,
          maxTokens: maxTokens ?? 4096,
        });

        const totalTokens = result.tokens.total || result.tokens.input + result.tokens.output;

        await usageService.recordAIUsageEvent({
          userId: auth.sub,
          feature: 'CODE_FIX',
          model: result.model,
          inputTokens: result.tokens.input,
          outputTokens: result.tokens.output,
          creditsConsumed: creditCost,
          estimatedCostUsd: result.cost?.totalCost ?? 0,
        });

        return reply.send({
          success: true,
          provider: result.provider,
          model: result.model,
          response: result.content,
          latencyMs: result.latencyMs,
          usage: {
            input: result.tokens.input,
            output: result.tokens.output,
            total: totalTokens,
          },
        });
      } catch (error) {
        await usageService.refundQuota(auth.sub, 'AI_CREDITS', creditCost);
        app.log.error({ err: error, provider }, 'Code fix generation failed');
        const errorResponse = classifyAIError(error);
        return reply.status(errorResponse.status).send({
          success: false,
          error: {
            code: errorResponse.code,
            message: errorResponse.message,
            retryable: errorResponse.retryable,
          },
        });
      }
    },
  );
}
