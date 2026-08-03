import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workflowEngine } from '@/core/ai/workflow/engine';
import { WorkflowType } from '@/core/ai/workflow/types';

const streamRequestSchema = z.object({
  workflowType: z.enum([
    'PLAYGROUND',
    'CODE_REVIEW',
    'PR_REVIEW',
    'PR_ANALYSIS',
    'REPOSITORY_CHAT',
    'DOCUMENTATION',
    'TEST_GENERATION',
    'SECURITY_REVIEW',
    'ARCHITECTURE_REVIEW',
  ]),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter']).default('gemini'),
  model: z.string().optional(),
  prompt: z.string().optional(),
  context: z.record(z.unknown()).default({}),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type StreamRequest = z.infer<typeof streamRequestSchema>;

export async function streamingRoutes(app: FastifyInstance) {
  app.post<{
    Body: StreamRequest;
  }>(
    '/stream',
    {
      schema: {
        description: 'Stream AI workflow response using Server-Sent Events',
        tags: ['ai', 'streaming'],
        body: {
          type: 'object',
          required: ['workflowType'],
          properties: {
            workflowType: { type: 'string', enum: Object.values(WorkflowType) },
            provider: { type: 'string', enum: ['gemini', 'openai', 'anthropic', 'openrouter'] },
            model: { type: 'string' },
            prompt: { type: 'string' },
            context: { type: 'object' },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            maxTokens: { type: 'number', minimum: 1, maximum: 100000 },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = streamRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.errors.map((e) => e.message).join(', '),
          },
        });
      }

      const { workflowType, provider, model, prompt, context, temperature, maxTokens, metadata } =
        parsed.data;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvent = (data: unknown) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const stream = workflowEngine.executeStream({
          workflowType: workflowType as WorkflowType,
          provider,
          model: model as never,
          prompt,
          context,
          temperature,
          maxTokens,
          metadata,
        });

        for await (const chunk of stream) {
          sendEvent(chunk);
        }

        sendEvent({ type: 'done' });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: unknown }).code)
            : 'STREAM_ERROR';

        sendEvent({
          type: 'error',
          error: { code, message },
        });
      }

      reply.raw.end();
    },
  );
}
