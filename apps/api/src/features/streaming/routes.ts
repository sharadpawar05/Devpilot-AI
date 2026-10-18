import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { workflowEngine } from '@/core/ai/workflow/engine';
import { WorkflowType } from '@/core/ai/workflow/types';
import { resolveCorsOrigin } from '@/plugins/cors';
import { authenticate } from '@/core/auth';
import { aiService } from '@/core/ai/service';
import { classifyAIError } from '@/core/ai/classify-error';
import {
  usageService,
  sendUsageLimitReached,
  AI_CREDIT_COSTS,
  repoScopeFromFields,
  type AICreditCostKey,
} from '@/core/usage';

const MAX_PROMPT_CHARS = 100_000;
const MAX_CONTEXT_CHARS = 200_000;

const streamRequestSchema = z
  .object({
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
    prompt: z.string().max(MAX_PROMPT_CHARS).optional(),
    context: z.record(z.unknown()).default({}),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(100000).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    const contextSize = JSON.stringify(value.context ?? {}).length;
    if (contextSize > MAX_CONTEXT_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `context is too large (${contextSize} chars, max ${MAX_CONTEXT_CHARS})`,
        path: ['context'],
      });
    }
  });

type StreamRequest = z.infer<typeof streamRequestSchema>;

/** Workflows that operate on a GitHub repository and require a repo scope. */
const REPO_SCOPED_WORKFLOWS = new Set<string>([
  'PR_REVIEW',
  'PR_ANALYSIS',
  'REPOSITORY_CHAT',
  'SECURITY_REVIEW',
  'ARCHITECTURE_REVIEW',
]);

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
      config: {
        // AI streaming is expensive — tighter than the global ceiling.
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
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
            prompt: { type: 'string', maxLength: MAX_PROMPT_CHARS },
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

      const scope =
        repoScopeFromFields(context.owner, context.repo) ??
        repoScopeFromFields(metadata?.owner, metadata?.repo);

      // Repo-scoped workflows must carry owner/repo and respect the
      // REPOSITORIES plan limit before any credits are spent.
      if (REPO_SCOPED_WORKFLOWS.has(workflowType)) {
        if (!scope) {
          return reply.status(400).send({
            success: false,
            error: {
              code: 'MISSING_REPO_SCOPE',
              message: `workflowType '${workflowType}' requires context.owner and context.repo`,
            },
          });
        }
      }
      if (scope) {
        const access = await usageService.ensureRepositoryAccess(auth.sub, scope.owner, scope.repo);
        if (!access.allowed && access.details) {
          return sendUsageLimitReached(reply, access.details);
        }
      }

      const consume = await consumeStreamQuota(auth.sub, workflowType);
      if (!consume.allowed && consume.details) {
        return sendUsageLimitReached(reply, consume.details);
      }

      const accessControlOrigin = resolveCorsOrigin(request.headers.origin);

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...(accessControlOrigin
          ? {
              'Access-Control-Allow-Origin': accessControlOrigin,
              ...(accessControlOrigin !== '*'
                ? { 'Access-Control-Allow-Credentials': 'true' }
                : {}),
            }
          : {}),
      });

      // Abort the provider stream as soon as the client disconnects so we
      // stop paying for tokens nobody will read.
      const abortController = new AbortController();
      let clientGone = false;
      let streamSettled = false;
      const onClientClose = () => {
        clientGone = true;
        abortController.abort();
      };
      request.raw.on('close', onClientClose);

      const sendEvent = (data: unknown) => {
        if (clientGone) return;
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      let streamFailed = false;

      try {
        if (clientGone) {
          streamSettled = true;
          await refundStreamQuota(auth.sub, workflowType);
          return reply;
        }

        const stream = workflowEngine.executeStream({
          workflowType: workflowType as WorkflowType,
          provider,
          model: model as never,
          prompt,
          context,
          temperature,
          maxTokens,
          metadata,
          signal: abortController.signal,
        });

        for await (const chunk of stream) {
          if (clientGone) break;
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

        if (streamFailed || clientGone) {
          // Provider error or client disconnect: refund what was consumed.
          streamSettled = true;
          await refundStreamQuota(auth.sub, workflowType);
        } else {
          streamSettled = true;
          sendEvent({ type: 'done' });
        }
      } catch (error) {
        if (!clientGone) {
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
        }
        if (!streamSettled) {
          streamSettled = true;
          await refundStreamQuota(auth.sub, workflowType);
        }
      } finally {
        request.raw.removeListener('close', onClientClose);
      }

      if (!clientGone) {
        reply.raw.end();
      }
      return reply;
    },
  );
}
