import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import { authenticate } from '@/core/auth/middleware';
import { usageService, sendUsageLimitReached, AI_CREDIT_COSTS } from '@/core/usage';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';
import { resolveAIRequestDefaults } from '@/features/settings/ai-prefs';
import { notifyIfEnabled } from '@/features/notifications/routes';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

const REVIEW_TYPES = [
  'Standard',
  'Performance',
  'Security',
  'Maintainability',
  'Architecture',
  'Interview Feedback',
] as const;

const REVIEW_DEPTHS = ['Quick', 'Standard', 'Deep'] as const;

const DEPTH_MAX_TOKENS: Record<string, number> = {
  Quick: 1024,
  Standard: 2048,
  Deep: 4096,
};

const codeReviewSchema = z.object({
  language: z.string().min(1, 'Language is required'),
  reviewType: z.enum(REVIEW_TYPES).default('Standard'),
  reviewDepth: z.enum(REVIEW_DEPTHS).default('Standard'),
  code: z.string().min(1, 'Code is required').max(100000, 'Code too long'),
  context: z.string().max(10000, 'Context too long').optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
});

type CodeReviewRequest = z.infer<typeof codeReviewSchema>;

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
  groq: 'qwen/qwen3.8-27b',
};

export async function codeReviewRoutes(app: FastifyInstance) {
  app.post<{
    Body: CodeReviewRequest;
  }>(
    '/code-review',
    {
      preHandler: [authenticate],
      config: {
        // AI reviews are expensive — tighter than the global ceiling.
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
      schema: {
        description: 'AI-powered code review with structured feedback',
        tags: ['ai'],
        body: {
          type: 'object',
          required: ['language', 'code'],
          properties: {
            language: { type: 'string', minLength: 1 },
            reviewType: { type: 'string', enum: [...REVIEW_TYPES] },
            reviewDepth: { type: 'string', enum: [...REVIEW_DEPTHS] },
            code: { type: 'string', minLength: 1, maxLength: 100000 },
            context: { type: 'string', maxLength: 10000 },
            provider: {
              type: 'string',
              enum: ['gemini', 'openai', 'anthropic', 'openrouter', 'groq'],
            },
            model: { type: 'string', minLength: 1 },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            maxTokens: { type: 'number', minimum: 1, maximum: 100000 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              provider: { type: 'string' },
              model: { type: 'string' },
              response: { type: 'string' },
              latencyMs: { type: 'number' },
              reviewDepth: { type: 'string' },
              usage: {
                type: 'object',
                properties: {
                  input: { type: 'number' },
                  output: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      // Fill any omitted AI fields from the user's saved preferences so the
      // settings tab is the source of truth; explicit values always win.
      const body = await resolveAIRequestDefaults(
        auth.sub,
        request.body as Record<string, unknown>,
      );
      const parsed = codeReviewSchema.safeParse(body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((e) => e.message).join(', '),
          },
        });
      }

      const {
        language,
        reviewType,
        reviewDepth,
        code,
        context,
        provider,
        model,
        temperature,
        maxTokens,
      } = parsed.data;

      const availableProviders = aiService.getAvailableProviders();
      if (!availableProviders.includes(provider)) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'PROVIDER_UNAVAILABLE',
            message: `Provider '${provider}' is not configured. Available: ${availableProviders.join(', ') || 'none'}. Set the corresponding API key in your .env file.`,
          },
        });
      }

      // Code review is NOT an Engineering Report (AI_REPORT).
      // Consume AI credits only, using the centralized PR_REVIEW cost.
      const creditCost = AI_CREDIT_COSTS.PR_REVIEW;
      const consume = await usageService.consumeQuota(auth.sub, 'AI_CREDITS', creditCost);
      if (!consume.allowed && consume.details) {
        return sendUsageLimitReached(reply, consume.details);
      }

      let rendered;
      try {
        rendered = registry.render('prompt_code_review', {
          language,
          code,
          context: context ?? '',
          reviewType,
          reviewDepth,
          isQuick: reviewDepth === 'Quick' ? 'yes' : undefined,
          isStandard: reviewDepth === 'Standard' ? 'yes' : undefined,
          isDeep: reviewDepth === 'Deep' ? 'yes' : undefined,
        });
      } catch (error) {
        await usageService.refundQuota(auth.sub, 'AI_CREDITS', creditCost);
        app.log.error({ err: error }, 'Prompt rendering failed');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMPT_ERROR',
            message: 'Failed to render prompt',
          },
        });
      }

      const effectiveMaxTokens = maxTokens ?? DEPTH_MAX_TOKENS[reviewDepth] ?? 2048;

      try {
        const result = await aiService.generate(rendered.userPrompt, rendered.systemPrompt, {
          provider,
          model: (model ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini) as never,
          temperature,
          maxTokens: effectiveMaxTokens,
        });

        const totalTokens = result.tokens.total || result.tokens.input + result.tokens.output;

        await usageService.recordAIUsageEvent({
          userId: auth.sub,
          feature: 'CODE_REVIEW',
          model: result.model,
          inputTokens: result.tokens.input,
          outputTokens: result.tokens.output,
          creditsConsumed: creditCost,
          estimatedCostUsd: result.cost?.totalCost ?? 0,
        });

        // In-app notification, honoring the user's notification preferences
        // (fails soft — never breaks the review response).
        await notifyIfEnabled(
          auth.sub,
          'review_complete',
          'Code review completed',
          `Your ${reviewType} review (${reviewDepth} depth) of ${language} code is ready.`,
        );

        return reply.send({
          success: true,
          provider: result.provider,
          model: result.model,
          response: result.content,
          latencyMs: result.latencyMs,
          reviewDepth,
          usage: {
            input: result.tokens.input,
            output: result.tokens.output,
            total: totalTokens,
          },
        });
      } catch (error) {
        await usageService.refundQuota(auth.sub, 'AI_CREDITS', creditCost);
        app.log.error({ err: error, provider, model }, 'Code review failed');
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
