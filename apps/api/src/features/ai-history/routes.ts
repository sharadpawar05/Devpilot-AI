import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@/core/auth';
import { db } from '@/core/db';
import { usageService, sendUsageLimitReached, repoScopeFromString } from '@/core/usage';

async function ensureUserExists(sub: string, email?: string): Promise<void> {
  const existing = await db.user.findUnique({
    where: { supabaseUserId: sub },
    select: { id: true },
  });
  if (!existing) {
    await db.user.create({
      data: {
        supabaseUserId: sub,
        email: email || `${sub}@placeholder.local`,
        fullName: 'User',
      },
    });
  }
}

const createSessionSchema = z.object({
  workflowType: z.enum([
    'playground',
    'code-review',
    'pr-review',
    'pr-analysis',
    'repository-chat',
    'documentation',
    'test-generation',
    'security-review',
    'architecture-review',
  ]),
  repository: z.string().optional(),
  title: z.string().min(1),
  provider: z.string(),
  model: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
      latency: z.number().optional().default(0),
      tokens: z.number().optional().default(0),
    }),
  ),
});

const updateSessionSchema = z.object({
  title: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  favorite: z.boolean().optional(),
});

const appendMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
        latency: z.number().optional().default(0),
        tokens: z.number().optional().default(0),
      }),
    )
    .min(1)
    .max(50),
});

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  workflowType: z.string().optional(),
  repository: z.string().optional(),
  provider: z.string().optional(),
  favorite: z.coerce.boolean().optional(),
  pinned: z.coerce.boolean().optional(),
  archived: z.coerce.boolean().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const workflowTypeMap: Record<string, string> = {
  playground: 'PLAYGROUND',
  'code-review': 'CODE_REVIEW',
  'pr-review': 'PR_REVIEW',
  'pr-analysis': 'PR_ANALYSIS',
  'repository-chat': 'REPOSITORY_CHAT',
  documentation: 'DOCUMENTATION',
  'test-generation': 'TEST_GENERATION',
  'security-review': 'SECURITY_REVIEW',
  'architecture-review': 'ARCHITECTURE_REVIEW',
};

const workflowTypeReverseMap: Record<string, string> = {
  PLAYGROUND: 'playground',
  CODE_REVIEW: 'code-review',
  PR_REVIEW: 'pr-review',
  PR_ANALYSIS: 'pr-analysis',
  REPOSITORY_CHAT: 'repository-chat',
  DOCUMENTATION: 'documentation',
  TEST_GENERATION: 'test-generation',
  SECURITY_REVIEW: 'security-review',
  ARCHITECTURE_REVIEW: 'architecture-review',
};

export async function aiHistoryRoutes(app: FastifyInstance) {
  app.post(
    '/ai-history/sessions',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Create a new AI history session',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;

      const parsed = createSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
        });
      }

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Sessions feed the Active Repositories counter, so a session for a
      // repository the user has not activated must go through the plan limit.
      const scope = repoScopeFromString(parsed.data.repository);
      if (scope) {
        const access = await usageService.ensureRepositoryAccess(auth.sub, scope.owner, scope.repo);
        if (!access.allowed && access.details) {
          return sendUsageLimitReached(reply, access.details);
        }
      }

      const { messages, ...sessionData } = parsed.data;
      const totalLatency = messages.reduce((sum, m) => sum + m.latency, 0);
      const totalTokens = messages.reduce((sum, m) => sum + m.tokens, 0);

      const session = await db.aIHistorySession.create({
        data: {
          userId: user.id,
          workflowType: workflowTypeMap[sessionData.workflowType] as never,
          repository: sessionData.repository,
          title: sessionData.title,
          provider: sessionData.provider,
          model: sessionData.model,
          totalLatency,
          totalTokens,
          messages: {
            create: messages.map((m) => ({
              role: m.role,
              content: m.content,
              latency: m.latency,
              tokens: m.tokens,
            })),
          },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      return reply.send({
        success: true,
        id: session.id,
        workflowType:
          workflowTypeReverseMap[session.workflowType] || session.workflowType.toLowerCase(),
        repository: session.repository,
        title: session.title,
        provider: session.provider,
        model: session.model,
        totalLatency: session.totalLatency,
        totalTokens: session.totalTokens,
        pinned: session.pinned,
        archived: session.archived,
        favorite: session.favorite,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            latency: number;
            tokens: number;
            createdAt: Date;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            latency: m.latency,
            tokens: m.tokens,
            timestamp: m.createdAt.toISOString(),
          }),
        ),
      });
    },
  );

  app.get(
    '/ai-history/sessions',
    {
      preHandler: [authenticate],
      schema: {
        description: 'List AI history sessions',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string; email?: string } }).auth;

      await ensureUserExists(auth.sub, auth.email);

      const query = listQuerySchema.parse(request.query);

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const where: Record<string, unknown> = { userId: user.id };

      if (query.workflowType) {
        const types = query.workflowType
          .split(',')
          .map((t) => workflowTypeMap[t.trim()] || t.trim());
        where.workflowType = { in: types };
      }

      if (query.repository) {
        const repos = query.repository.split(',').map((r) => r.trim());
        where.repository = { in: repos };
      }

      if (query.provider) {
        const providers = query.provider.split(',').map((p) => p.trim());
        where.provider = { in: providers };
      }

      if (query.favorite !== undefined) {
        where.favorite = query.favorite;
      }

      if (query.pinned !== undefined) {
        where.pinned = query.pinned;
      }

      if (query.archived !== undefined) {
        where.archived = query.archived;
      }

      if (query.search) {
        where.OR = [
          { title: { contains: query.search, mode: 'insensitive' } },
          { repository: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.dateFrom || query.dateTo) {
        where.createdAt = {};
        if (query.dateFrom) {
          (where.createdAt as Record<string, Date>).gte = new Date(query.dateFrom);
        }
        if (query.dateTo) {
          (where.createdAt as Record<string, Date>).lte = new Date(query.dateTo);
        }
      }

      const [sessions, total] = await Promise.all([
        db.aIHistorySession.findMany({
          where,
          orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            workflowType: true,
            repository: true,
            title: true,
            provider: true,
            model: true,
            totalLatency: true,
            totalTokens: true,
            pinned: true,
            archived: true,
            favorite: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { messages: true } },
          },
        }),
        db.aIHistorySession.count({ where }),
      ]);

      return reply.send({
        success: true,
        sessions: sessions.map(
          (s: {
            id: string;
            workflowType: string;
            repository: string | null;
            title: string;
            provider: string;
            model: string;
            totalLatency: number;
            totalTokens: number;
            pinned: boolean;
            archived: boolean;
            favorite: boolean;
            createdAt: Date;
            updatedAt: Date;
            _count: { messages: number };
          }) => ({
            id: s.id,
            workflowType: workflowTypeReverseMap[s.workflowType] || s.workflowType.toLowerCase(),
            repository: s.repository,
            title: s.title,
            provider: s.provider,
            model: s.model,
            totalLatency: s.totalLatency,
            totalTokens: s.totalTokens,
            messageCount: s._count.messages,
            pinned: s.pinned,
            archived: s.archived,
            favorite: s.favorite,
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
          }),
        ),
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          hasMore: query.page * query.pageSize < total,
        },
      });
    },
  );

  app.get(
    '/ai-history/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get a single AI history session with messages',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { id } = request.params as { id: string };

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const session = await db.aIHistorySession.findFirst({
        where: { id, userId: user.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      return reply.send({
        success: true,
        id: session.id,
        workflowType:
          workflowTypeReverseMap[session.workflowType] || session.workflowType.toLowerCase(),
        repository: session.repository,
        title: session.title,
        provider: session.provider,
        model: session.model,
        totalLatency: session.totalLatency,
        totalTokens: session.totalTokens,
        pinned: session.pinned,
        archived: session.archived,
        favorite: session.favorite,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            latency: number;
            tokens: number;
            createdAt: Date;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            latency: m.latency,
            tokens: m.tokens,
            timestamp: m.createdAt.toISOString(),
          }),
        ),
      });
    },
  );

  app.patch(
    '/ai-history/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Update an AI history session',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { id } = request.params as { id: string };

      const parsed = updateSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
        });
      }

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const existing = await db.aIHistorySession.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updates.title = parsed.data.title;
      if (parsed.data.pinned !== undefined) updates.pinned = parsed.data.pinned;
      if (parsed.data.archived !== undefined) updates.archived = parsed.data.archived;
      if (parsed.data.favorite !== undefined) updates.favorite = parsed.data.favorite;

      const session = await db.aIHistorySession.update({
        where: { id },
        data: updates,
      });

      return reply.send({
        success: true,
        id: session.id,
        pinned: session.pinned,
        archived: session.archived,
        favorite: session.favorite,
        title: session.title,
        updatedAt: session.updatedAt.toISOString(),
      });
    },
  );

  app.post(
    '/ai-history/sessions/:id/messages',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Append messages to an AI history session',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { id } = request.params as { id: string };

      const parsed = appendMessagesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
        });
      }

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const existing = await db.aIHistorySession.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      const { messages } = parsed.data;
      const addedLatency = messages.reduce((sum, m) => sum + m.latency, 0);
      const addedTokens = messages.reduce((sum, m) => sum + m.tokens, 0);

      const session = await db.aIHistorySession.update({
        where: { id },
        data: {
          totalLatency: { increment: addedLatency },
          totalTokens: { increment: addedTokens },
          messages: {
            create: messages.map((m) => ({
              role: m.role,
              content: m.content,
              latency: m.latency,
              tokens: m.tokens,
            })),
          },
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      return reply.send({
        success: true,
        id: session.id,
        workflowType:
          workflowTypeReverseMap[session.workflowType] || session.workflowType.toLowerCase(),
        repository: session.repository,
        title: session.title,
        provider: session.provider,
        model: session.model,
        totalLatency: session.totalLatency,
        totalTokens: session.totalTokens,
        pinned: session.pinned,
        archived: session.archived,
        favorite: session.favorite,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map(
          (m: {
            id: string;
            role: string;
            content: string;
            latency: number;
            tokens: number;
            createdAt: Date;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            latency: m.latency,
            tokens: m.tokens,
            timestamp: m.createdAt.toISOString(),
          }),
        ),
      });
    },
  );

  app.delete(
    '/ai-history/sessions/:id',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete an AI history session',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { id } = request.params as { id: string };

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const existing = await db.aIHistorySession.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Session not found' },
        });
      }

      await db.aIHistorySession.delete({ where: { id } });

      return reply.send({ success: true });
    },
  );

  app.delete(
    '/ai-history/sessions',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Delete multiple AI history sessions',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;
      const { ids } = request.body as { ids: string[] };

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'ids array is required' },
        });
      }

      if (ids.length > 100) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Maximum 100 sessions per request' },
        });
      }

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const result = await db.aIHistorySession.deleteMany({
        where: { id: { in: ids }, userId: user.id },
      });

      return reply.send({ success: true, deleted: result.count });
    },
  );

  app.get(
    '/ai-history/repositories',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get unique repositories from history',
        tags: ['ai-history'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: { id: true },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const result = await db.aIHistorySession.groupBy({
        by: ['repository'],
        where: { userId: user.id, repository: { not: null } },
      });

      return reply.send({
        success: true,
        repositories: result
          .map((r: { repository: string | null }) => r.repository)
          .filter(Boolean),
      });
    },
  );
}
