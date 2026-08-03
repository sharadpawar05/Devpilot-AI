import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiService } from '@/core/ai/service';
import { PromptRegistry, loadMarkdownPrompts } from '@devpilot/ai-prompts';

const registry = new PromptRegistry();
registry.registerAll(loadMarkdownPrompts());

const fixRequestSchema = z.object({
  code: z.string().min(1, 'Code is required').max(100000, 'Code too long'),
  language: z.string().min(1, 'Language is required'),
  reviewContext: z.string().max(20000).optional(),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
});

type FixRequest = z.infer<typeof fixRequestSchema>;

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-3.5-sonnet',
  openrouter: 'gpt-4',
};

export async function fixRoutes(app: FastifyInstance) {
  app.post<{
    Body: FixRequest;
  }>(
    '/ai/fix',
    {
      schema: {
        description: 'Generate structured code fixes with diffs and explanations',
        tags: ['ai', 'fix'],
        body: {
          type: 'object',
          required: ['code', 'language'],
          properties: {
            code: { type: 'string', minLength: 1, maxLength: 100000 },
            language: { type: 'string', minLength: 1 },
            reviewContext: { type: 'string', maxLength: 20000 },
            provider: { type: 'string', enum: ['gemini', 'openai', 'anthropic', 'openrouter'] },
            model: { type: 'string', minLength: 1 },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            maxTokens: { type: 'number', minimum: 1, maximum: 100000 },
          },
        },
      },
    },
    async (request, reply) => {
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
        const message = error instanceof Error ? error.message : String(error);
        app.log.error({ err: error }, 'Prompt rendering failed');
        return reply.status(500).send({
          success: false,
          error: {
            code: 'PROMPT_ERROR',
            message: `Failed to render prompt: ${message}`,
          },
        });
      }

      try {
        const result = await aiService.generate(rendered.userPrompt, rendered.systemPrompt, {
          provider,
          model: (model ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.gemini) as never,
          temperature: temperature ?? 0.1,
          maxTokens: maxTokens ?? 4096,
        });

        const totalTokens = result.tokens.total || result.tokens.input + result.tokens.output;

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
        const message = error instanceof Error ? error.message : String(error);
        const code_ =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'AI_ERROR';

        app.log.error({ err: error, provider, model }, 'Code fix generation failed');

        return reply.status(502).send({
          success: false,
          error: {
            code: code_,
            message,
          },
        });
      }
    },
  );
}
