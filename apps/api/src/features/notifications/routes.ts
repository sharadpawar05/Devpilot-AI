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

type PrefKey =
  | 'notifyReviewComplete'
  | 'notifyPrAnalysis'
  | 'notifyRepositorySync'
  | 'notifyGithubAlerts'
  | 'notifyWeeklySummary';

const PREF_BY_TYPE: Record<NotificationType, PrefKey> = {
  review_complete: 'notifyReviewComplete',
  pr_analysis: 'notifyPrAnalysis',
  repo_sync: 'notifyRepositorySync',
  github_alert: 'notifyGithubAlerts',
  weekly_summary: 'notifyWeeklySummary',
};

// Mirrors the UserSettings column defaults for users without a settings row.
const DEFAULT_PREFS: Record<NotificationType, boolean> = {
  review_complete: true,
  pr_analysis: true,
  repo_sync: false,
  github_alert: true,
  weekly_summary: false,
};

/**
 * Creates a notification for a user only if their saved preferences allow it.
 * Resolves the local User.id from the Supabase sub; fails soft like
 * createNotification (never breaks the triggering workflow).
 */
export async function notifyIfEnabled(
  supabaseSub: string,
  type: NotificationType,
  title: string,
  description: string,
): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { supabaseUserId: supabaseSub },
      select: {
        id: true,
        settings: {
          select: {
            notifyReviewComplete: true,
            notifyPrAnalysis: true,
            notifyRepositorySync: true,
            notifyGithubAlerts: true,
            notifyWeeklySummary: true,
          },
        },
      },
    });
    if (!user) return;
    const enabled = user.settings?.[PREF_BY_TYPE[type]] ?? DEFAULT_PREFS[type];
    if (!enabled) return;
    await db.notification.create({ data: { userId: user.id, type, title, description } });
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
    // updateMany keeps ownership in the WHERE clause so a delete racing
    // between check and write can't surface as an unhandled P2025 → 500.
    const result = await db.notification.updateMany({
      where: { id: params.data.id, userId },
      data: { read: true },
    });
    if (result.count === 0) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
    const updated = await db.notification.findFirst({
      where: { id: params.data.id, userId },
    });
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }
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
