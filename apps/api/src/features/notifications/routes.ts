import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticate } from '@/core/auth/middleware';
import type { AuthJWTPayload } from '@/core/auth/middleware';
import { db } from '@/core/db';
import {
  listNotificationsQuerySchema,
  markReadParamSchema,
  type NOTIFICATION_TYPES,
} from './schema';

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

async function localUserId(sub: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { supabaseUserId: sub },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Persists an in-app notification for a user. Intended to be called by AI
 * feature routes when a workflow completes (subject to the user's saved
 * notification preferences). Fails soft: notification delivery must never
 * break the triggering workflow.
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  description: string,
): Promise<void> {
  try {
    await db.notification.create({ data: { userId, type, title, description } });
  } catch {
    // best-effort
  }
}

function toNotification(n: {
  id: string;
  title: string;
  description: string;
  type: string;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    type: n.type,
    read: n.read,
    timestamp: n.createdAt.toISOString(),
  };
}

export async function notificationsRoutes(app: FastifyInstance) {
  // GET /notifications
  app.get('/notifications', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
    const parsed = listNotificationsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query', details: parsed.error.issues },
      });
    }
    const userId = await localUserId(auth.sub);
    if (!userId) {
      return reply.send({ success: true, notifications: [] });
    }
    const { unread, limit } = parsed.data;
    const rows = await db.notification.findMany({
      where: { userId, ...(unread === true ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send({ success: true, notifications: rows.map(toNotification) });
  });

  // GET /notifications/unread-count
  app.get('/notifications/unread-count', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
    const userId = await localUserId(auth.sub);
    if (!userId) {
      return reply.send({ success: true, count: 0 });
    }
    const count = await db.notification.count({ where: { userId, read: false } });
    return reply.send({ success: true, count });
  });

  // PATCH /notifications/:id/read
  app.patch('/notifications/:id/read', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
    const params = markReadParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid notification id',
          details: params.error.issues,
        },
      });
    }
    const userId = await localUserId(auth.sub);
    if (!userId) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    const existing = await db.notification.findFirst({
      where: { id: params.data.id, userId },
      select: { id: true },
    });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    const updated = await db.notification.update({
      where: { id: params.data.id },
      data: { read: true },
    });
    return reply.send({ success: true, notification: toNotification(updated) });
  });

  // POST /notifications/read-all
  app.post(
    '/notifications/read-all',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const userId = await localUserId(auth.sub);
      if (!userId) {
        return reply.send({ success: true, updated: 0 });
      }
      const result = await db.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return reply.send({ success: true, updated: result.count });
    },
  );
}
