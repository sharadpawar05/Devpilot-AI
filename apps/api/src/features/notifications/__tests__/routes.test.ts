import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('@/core/auth/middleware', () => ({
  authenticate: async (
    request: { headers: Record<string, string | undefined>; auth?: unknown },
    reply: { status: (c: number) => { send: (p: unknown) => unknown } },
  ) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      });
    }
    request.auth = { sub: header.slice(7) };
  },
}));

const db = {
  user: { findUnique: vi.fn() },
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('@/core/db', () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => db.user.findUnique(...args) },
    notification: {
      findMany: (...args: unknown[]) => db.notification.findMany(...args),
      findFirst: (...args: unknown[]) => db.notification.findFirst(...args),
      count: (...args: unknown[]) => db.notification.count(...args),
      update: (...args: unknown[]) => db.notification.update(...args),
      updateMany: (...args: unknown[]) => db.notification.updateMany(...args),
      create: (...args: unknown[]) => db.notification.create(...args),
    },
  },
}));

import { notificationsRoutes, notifyIfEnabled } from '@/features/notifications/routes';

const notif = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  title: 'Review complete',
  description: 'PR #1 reviewed',
  type: 'review_complete',
  read: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await notificationsRoutes(app);
  await app.ready();
  return app;
}

describe('notifications routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /notifications returns only the authenticated user notifications (cross-user isolation)', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.notification.findMany.mockResolvedValue([notif]);

    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { notifications: Array<{ read: boolean; timestamp: string }> };
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].timestamp).toBe('2026-01-01T00:00:00.000Z');
    // Query is scoped to the resolved local user id.
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
    );
  });

  it('GET /notifications?unread=true filters to unread only', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.notification.findMany.mockResolvedValue([notif]);

    const res = await app.inject({
      method: 'GET',
      url: '/notifications?unread=true',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', read: false } }),
    );
  });

  it('GET /notifications/unread-count returns the user unread count', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.notification.count.mockResolvedValue(3);

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { count: number };
    expect(body.count).toBe(3);
  });

  it("PATCH /notifications/:id/read returns 404 for another user's notification (cross-user isolation)", async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-2' });
    db.notification.findFirst.mockResolvedValue(null); // belongs to user-1, not user-2

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${notif.id}/read`,
      headers: { authorization: 'Bearer supa-2' },
    });

    expect(res.statusCode).toBe(404);
    expect(db.notification.update).not.toHaveBeenCalled();
  });

  it('PATCH /notifications/:id/read marks own notification read', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.notification.findFirst.mockResolvedValue({ id: notif.id });
    db.notification.update.mockResolvedValue({ ...notif, read: true });

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${notif.id}/read`,
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.notification.update).toHaveBeenCalledWith({
      where: { id: notif.id },
      data: { read: true },
    });
  });

  it('PATCH /notifications/:id/read rejects a non-uuid id', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/not-a-uuid/read',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /notifications/read-all only updates the authenticated user', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.notification.updateMany.mockResolvedValue({ count: 2 });

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/read-all',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', read: false },
      data: { read: true },
    });
  });
});

describe('notifyIfEnabled', () => {
  const enabledSettings = {
    notifyReviewComplete: true,
    notifyPrAnalysis: true,
    notifyRepositorySync: false,
    notifyGithubAlerts: true,
    notifyWeeklySummary: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.notification.create.mockResolvedValue({});
  });

  it('creates a notification when the matching preference is enabled', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1', settings: enabledSettings });

    await notifyIfEnabled('supa-1', 'review_complete', 'Code review completed', 'Ready.');

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { supabaseUserId: 'supa-1' },
      select: expect.objectContaining({ id: true }),
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'review_complete',
        title: 'Code review completed',
        description: 'Ready.',
      },
    });
  });

  it('skips creation when the matching preference is disabled', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      settings: { ...enabledSettings, notifyReviewComplete: false },
    });

    await notifyIfEnabled('supa-1', 'review_complete', 'Code review completed', 'Ready.');

    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('falls back to column defaults when the user has no settings row', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user-1', settings: null });

    // review_complete defaults to enabled…
    await notifyIfEnabled('supa-1', 'review_complete', 'T', 'D');
    expect(db.notification.create).toHaveBeenCalledTimes(1);

    // …repo_sync defaults to disabled.
    await notifyIfEnabled('supa-1', 'repo_sync', 'T', 'D');
    expect(db.notification.create).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user does not exist', async () => {
    db.user.findUnique.mockResolvedValue(null);

    await notifyIfEnabled('supa-unknown', 'review_complete', 'T', 'D');

    expect(db.notification.create).not.toHaveBeenCalled();
  });

  it('fails soft when the database errors', async () => {
    db.user.findUnique.mockRejectedValue(new Error('connection lost'));

    await expect(notifyIfEnabled('supa-1', 'review_complete', 'T', 'D')).resolves.toBeUndefined();
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
