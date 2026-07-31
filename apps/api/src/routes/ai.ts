import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiService } from '@/lib/ai';

const chatRequestSchema = z.object({
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
  model: z.string().min(1, 'Model is required'),
  prompt: z.string().min(1, 'Prompt is required').max(100000, 'Prompt too long'),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
});

type ChatRequest = z.infer<typeof chatRequestSchema>;

export async function aiRoutes(app: FastifyInstance) {
  app.post<{
    Body: ChatRequest;
  }>(
    '/ai/chat',
    {
      schema: {
        description: 'Send a chat prompt to an AI provider',
        tags: ['ai'],
        body: {
          type: 'object',
          required: ['model', 'prompt'],
          properties: {
            provider: { type: 'string', enum: ['gemini', 'openai', 'anthropic', 'openrouter'] },
            model: { type: 'string', minLength: 1 },
            prompt: { type: 'string', minLength: 1, maxLength: 100000 },
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
      const parsed = chatRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { provider, model, prompt, temperature, maxTokens } = parsed.data;

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

      try {
        const result = await aiService.generate(prompt, undefined, {
          provider,
          model: model as never,
          temperature,
          maxTokens,
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
            total: result.tokens.total,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'AI_ERROR';

        app.log.error({ err: error, provider, model }, 'AI generation failed');

        return reply.status(502).send({
          success: false,
          error: {
            code,
            message,
          },
        });
      }
    },
  );
}
