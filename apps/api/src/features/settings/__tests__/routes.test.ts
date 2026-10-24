import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';

const TEST_ENV = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  COOKIE_SECRET: 'test-cookie-secret-16chars',
};

vi.mock('@/config', () => ({
  getEnv: () => TEST_ENV,
}));

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
    // Token format: "sub" or "sub|sessionId"
    const raw = header.slice(7);
    const [sub, sessionId] = raw.split('|');
    request.auth = { sub, session_id: sessionId };
  },
}));

const db = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userSettings: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
};

vi.mock('@/core/db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => db.user.findUnique(...args),
      update: (...args: unknown[]) => db.user.update(...args),
      delete: (...args: unknown[]) => db.user.delete(...args),
    },
    userSettings: {
      findUnique: (...args: unknown[]) => db.userSettings.findUnique(...args),
      create: (...args: unknown[]) => db.userSettings.create(...args),
      upsert: (...args: unknown[]) => db.userSettings.upsert(...args),
    },
    notification: {
      findMany: (...args: unknown[]) => db.notification.findMany(...args),
      findFirst: (...args: unknown[]) => db.notification.findFirst(...args),
      count: (...args: unknown[]) => db.notification.count(...args),
      update: (...args: unknown[]) => db.notification.update(...args),
      updateMany: (...args: unknown[]) => db.notification.updateMany(...args),
      create: (...args: unknown[]) => db.notification.create(...args),
    },
    $queryRaw: (...args: unknown[]) => db.$queryRaw(...args),
    $executeRaw: (...args: unknown[]) => db.$executeRaw(...args),
    $transaction: (...args: unknown[]) => db.$transaction(...args),
  },
}));

import { settingsRoutes } from '@/features/settings/routes';

const defaultSettingsRow = {
  id: 'settings-1',
  userId: 'user-1',
  timezone: 'America/New_York',
  defaultProvider: 'gemini',
  defaultModel: 'gemini-3.6-flash',
  temperature: 0.7,
  maxTokens: 4096,
  streamResponses: true,
  markdownOutput: true,
  autoScroll: true,
  autoCopy: false,
  defaultReviewType: 'standard',
  defaultReviewDepth: 'moderate',
  defaultRepository: null,
  defaultBranch: 'main',
  theme: 'system',
  compactMode: false,
  fontSize: 'default',
  accentColor: 'blue',
  notifyReviewComplete: true,
  notifyPrAnalysis: true,
  notifyRepositorySync: false,
  notifyGithubAlerts: true,
  notifyWeeklySummary: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const localUser = {
  id: 'user-1',
  email: 'a@test.com',
  fullName: 'Alice',
  avatarUrl: null,
};

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(cookie, { secret: TEST_ENV.COOKIE_SECRET });
  await settingsRoutes(app);
  await app.ready();
  return app;
}

describe('settings routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /settings upserts-on-read and returns defaults for a fresh user', async () => {
    db.user.findUnique.mockResolvedValue(localUser);
    db.userSettings.findUnique.mockResolvedValue(null);
    db.userSettings.create.mockResolvedValue(defaultSettingsRow);

    const res = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: 'Bearer supa-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success: boolean;
      profile: { timezone: string };
      ai: { defaultProvider: string };
    };
    expect(body.success).toBe(true);
    expect(body.profile.timezone).toBe('America/New_York');
    expect(body.ai.defaultProvider).toBe('gemini');
    expect(db.userSettings.create).toHaveBeenCalledWith({ data: { userId: 'user-1' } });
  });

  it('PATCH /settings/profile persists timezone for the authenticated user only', async () => {
    db.user.findUnique.mockResolvedValue(localUser);
    const savedSettings = { ...defaultSettingsRow, timezone: 'Asia/Kolkata' };
    db.$transaction.mockResolvedValue([localUser, savedSettings]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { timezone: 'Asia/Kolkata' },
    });

    expect(res.statusCode).toBe(200);
    // Name omitted → User.update gets empty data; only timezone is written.
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: {} });
    expect(db.userSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: { timezone: 'Asia/Kolkata' },
      create: { userId: 'user-1', timezone: 'Asia/Kolkata' },
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it('PATCH /settings/profile updates the editable full name', async () => {
    db.user.findUnique.mockResolvedValue(localUser);
    const updatedUser = { ...localUser, fullName: 'Alice Smith' };
    db.$transaction.mockResolvedValue([updatedUser, defaultSettingsRow]);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { name: 'Alice Smith', timezone: 'UTC' },
    });

    expect(res.statusCode).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { fullName: 'Alice Smith' },
    });
    const body = res.json() as { profile: { name: string } };
    expect(body.profile.name).toBe('Alice Smith');
  });

  it('PATCH /settings/profile rejects an empty name', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { name: '   ', timezone: 'UTC' },
    });

    expect(res.statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('PATCH /settings/profile accepts a legacy browser timezone alias', async () => {
    db.user.findUnique.mockResolvedValue(localUser);
    db.userSettings.upsert.mockResolvedValue({ ...defaultSettingsRow, timezone: 'Asia/Calcutta' });

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { timezone: 'Asia/Calcutta' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('PATCH /settings/profile rejects an unsupported timezone', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { timezone: 'Mars/Olympus' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(db.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('PATCH /settings/profile rejects unknown fields (strict schema)', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/profile',
      headers: { authorization: 'Bearer supa-1' },
      payload: { timezone: 'UTC', evil: 'payload' },
    });

    expect(res.statusCode).toBe(400);
    expect(db.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('PATCH /settings/ai rejects out-of-range temperature', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/ai',
      headers: { authorization: 'Bearer supa-1' },
      payload: { temperature: 5 },
    });

    expect(res.statusCode).toBe(400);
    expect(db.userSettings.upsert).not.toHaveBeenCalled();
  });

  it('PATCH /settings/ai persists a valid full payload', async () => {
    db.user.findUnique.mockResolvedValue(localUser);
    db.userSettings.upsert.mockResolvedValue({ ...defaultSettingsRow, temperature: 0.3 });

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/ai',
      headers: { authorization: 'Bearer supa-1' },
      payload: {
        defaultProvider: 'groq',
        defaultModel: 'qwen/qwen3.8-27b',
        temperature: 0.3,
        maxTokens: 8192,
        streamResponses: false,
        markdownOutput: true,
        autoScroll: true,
        autoCopy: false,
        defaultReviewType: 'deep',
        defaultReviewDepth: 'thorough',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(db.userSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: expect.objectContaining({ defaultProvider: 'groq', temperature: 0.3 }),
      }),
    );
  });

  it('PATCH /settings/appearance rejects an unknown theme', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/appearance',
      headers: { authorization: 'Bearer supa-1' },
      payload: { theme: 'neon', compactMode: false, fontSize: 'default', accentColor: 'blue' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /settings/account-sessions degrades gracefully when auth schema is unreachable', async () => {
    db.$queryRaw.mockRejectedValue(new Error('permission denied for schema auth'));

    const res = await app.inject({
      method: 'GET',
      url: '/settings/account-sessions',
      headers: { authorization: 'Bearer supa-1|sess-current' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      supported: boolean;
      sessions: unknown[];
      currentSessionId: string;
    };
    expect(body.supported).toBe(false);
    expect(body.sessions).toEqual([]);
    expect(body.currentSessionId).toBe('sess-current');
  });

  it('POST /settings/account-sessions/revoke-others deletes other sessions only', async () => {
    db.$executeRaw.mockResolvedValue(2);

    const res = await app.inject({
      method: 'POST',
      url: '/settings/account-sessions/revoke-others',
      headers: { authorization: 'Bearer supa-1|sess-current' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { revoked: number };
    expect(body.revoked).toBe(2);
  });

  it('DELETE /settings/account rejects when the same session confirms (no re-auth)', async () => {
    // Start challenge with sess-A, then confirm with the SAME sess-A.
    const challengeRes = await app.inject({
      method: 'POST',
      url: '/settings/account/delete-challenge',
      headers: { authorization: 'Bearer supa-1|sess-A' },
    });
    expect(challengeRes.statusCode).toBe(200);
    const cookieHeader = challengeRes.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await app.inject({
      method: 'DELETE',
      url: '/settings/account',
      headers: { authorization: 'Bearer supa-1|sess-A', cookie: cookieHeader },
      payload: { confirm: true },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('REAUTH_REQUIRED');
    expect(db.user.delete).not.toHaveBeenCalled();
  });

  it('DELETE /settings/account succeeds after re-auth (different session) and deletes the user', async () => {
    db.user.findUnique.mockResolvedValue(localUser);

    const challengeRes = await app.inject({
      method: 'POST',
      url: '/settings/account/delete-challenge',
      headers: { authorization: 'Bearer supa-1|sess-A' },
    });
    const cookieHeader = challengeRes.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await app.inject({
      method: 'DELETE',
      url: '/settings/account',
      headers: { authorization: 'Bearer supa-1|sess-B', cookie: cookieHeader },
      payload: { confirm: true },
    });

    expect(res.statusCode).toBe(200);
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('DELETE /settings/account rejects a challenge belonging to another user', async () => {
    const challengeRes = await app.inject({
      method: 'POST',
      url: '/settings/account/delete-challenge',
      headers: { authorization: 'Bearer supa-1|sess-A' },
    });
    const cookieHeader = challengeRes.cookies.map((c) => `${c.name}=${c.value}`).join('; ');

    const res = await app.inject({
      method: 'DELETE',
      url: '/settings/account',
      headers: { authorization: 'Bearer supa-2|sess-B', cookie: cookieHeader },
      payload: { confirm: true },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json() as { error: { code: string } };
    expect(body.error.code).toBe('CHALLENGE_MISMATCH');
    expect(db.user.delete).not.toHaveBeenCalled();
  });
});
