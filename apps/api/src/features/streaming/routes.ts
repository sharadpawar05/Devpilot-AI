import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workflowEngine } from '@/core/ai/workflow/engine';
import { WorkflowType } from '@/core/ai/workflow/types';
import { getEnv } from '@/config';
import { authenticate } from '@/core/auth';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import {
  usageService,
  sendUsageLimitReached,
  AI_CREDIT_COSTS,
  type AICreditCostKey,
} from '@/core/usage';

const streamRequestSchema = z.object({
  workflowType: z.enum([
    'PLAYGROUND',
    'CODE_REVIEW',
    'CODE_FIX',
    'PR_REVIEW',
    'PR_ANALYSIS',
    'REPOSITORY_CHAT',
    'DOCUMENTATION',
    'TEST_GENERATION',
    'SECURITY_REVIEW',
    'ARCHITECTURE_REVIEW',
  ]),
  provider: z.enum(['gemini', 'openai', 'anthropic', 'openrouter', 'groq']).default('gemini'),
  model: z.string().optional(),
  prompt: z.string().optional(),
  context: z.record(z.unknown()).default({}),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(100000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type StreamRequest = z.infer<typeof streamRequestSchema>;

interface QuotaCharge {
  mode: 'credits' | 'withCredits';
  feature: 'AI_CREDITS' | 'CHAT_MESSAGE' | 'AI_REPORT';
  creditKey: AICreditCostKey;
}

function quotaForWorkflow(workflowType: StreamRequest['workflowType']): QuotaCharge {
  switch (workflowType) {
    case 'PLAYGROUND':
      return { mode: 'withCredits', feature: 'CHAT_MESSAGE', creditKey: 'SIMPLE_CHAT' };
    case 'REPOSITORY_CHAT':
      return { mode: 'withCredits', feature: 'CHAT_MESSAGE', creditKey: 'REPOSITORY_CHAT' };
    case 'CODE_REVIEW':
    case 'CODE_FIX':
    case 'PR_REVIEW':
    case 'PR_ANALYSIS':
      return { mode: 'credits', feature: 'AI_CREDITS', creditKey: 'PR_REVIEW' };
    case 'SECURITY_REVIEW':
    case 'ARCHITECTURE_REVIEW':
      return { mode: 'credits', feature: 'AI_CREDITS', creditKey: 'ARCHITECTURE_ANALYSIS' };
    case 'DOCUMENTATION':
    case 'TEST_GENERATION':
      return { mode: 'withCredits', feature: 'AI_REPORT', creditKey: 'AI_REPORT' };
    default:
      return { mode: 'credits', feature: 'AI_CREDITS', creditKey: 'SIMPLE_CHAT' };
  }
}

async function consumeStreamQuota(sub: string, workflowType: StreamRequest['workflowType']) {
  const plan = quotaForWorkflow(workflowType);
  if (plan.mode === 'withCredits') {
    return usageService.consumeWithCredits(
      sub,
      plan.feature as Exclude<typeof plan.feature, 'AI_CREDITS'>,
      plan.creditKey,
    );
  }
  return usageService.consumeQuota(sub, 'AI_CREDITS', AI_CREDIT_COSTS[plan.creditKey]);
}

async function refundStreamQuota(sub: string, workflowType: StreamRequest['workflowType']) {
  const plan = quotaForWorkflow(workflowType);
  if (plan.mode === 'withCredits') {
    await usageService.refundWithCredits(
      sub,
      plan.feature as Exclude<typeof plan.feature, 'AI_CREDITS'>,
      plan.creditKey,
    );
  } else {
    await usageService.refundQuota(sub, 'AI_CREDITS', AI_CREDIT_COSTS[plan.creditKey]);
  }
}

function toClassifiedStreamError(
  message: string,
  provider: string,
): { code: string; message: string; provider: string; retryable: boolean } {
  const classified = classifyAIError(new Error(message));
  return {
    code: classified.code,
    message: classified.message,
    provider,
    retryable: classified.retryable,
  };
}

export async function streamingRoutes(app: FastifyInstance) {
  app.post<{
    Body: StreamRequest;
  }>(
    '/stream',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Stream AI workflow response using Server-Sent Events',
        tags: ['ai', 'streaming'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['workflowType'],
          properties: {
            workflowType: { type: 'string', enum: Object.values(WorkflowType) },
            provider: {
              type: 'string',
              enum: ['gemini', 'openai', 'anthropic', 'openrouter', 'groq'],
            },
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
      const auth = (request as { auth: { sub: string } }).auth;

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

      const consume = await consumeStreamQuota(auth.sub, workflowType);
      if (!consume.allowed && consume.details) {
        return sendUsageLimitReached(reply, consume.details);
      }

      const env = getEnv();
      const origin = request.headers.origin;
      const allowedOrigins =
        env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim());

      let accessControlOrigin = '*';
      if (env.CORS_ORIGIN !== '*') {
        if (origin && allowedOrigins.includes(origin)) {
          accessControlOrigin = origin;
        } else if (Array.isArray(allowedOrigins) && allowedOrigins.length > 0) {
          accessControlOrigin = allowedOrigins[0];
        }
      }

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': accessControlOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Expose-Headers': 'Set-Cookie',
      });

      const sendEvent = (data: unknown) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      let streamFailed = false;

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
          if (chunk.type === 'error') {
            streamFailed = true;
            sendEvent({
              type: 'error',
              error: toClassifiedStreamError(
                chunk.error?.message ?? 'The AI provider returned an error.',
                chunk.provider ?? provider,
              ),
            });
            break;
          }
          sendEvent(chunk);
        }

        if (streamFailed) {
          await refundStreamQuota(auth.sub, workflowType);
        } else {
          sendEvent({ type: 'done' });
        }
      } catch (error) {
        const classified = classifyAIError(error);
        request.log.error({ err: error, provider, workflowType }, 'AI stream failed');
        sendEvent({
          type: 'error',
          error: {
            code: classified.code,
            message: classified.message,
            provider,
            retryable: classified.retryable,
          },
        });
        await refundStreamQuota(auth.sub, workflowType);
      }

      reply.raw.end();
      return reply;
    },
  );
}
