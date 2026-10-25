import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getEnv } from '@/config';
import { authenticate } from '@/core/auth/middleware';
import type { AuthJWTPayload } from '@/core/auth/middleware';
import { db } from '@/core/db';
import {
  profilePatchSchema,
  aiPatchSchema,
  githubPatchSchema,
  appearancePatchSchema,
  notificationsPatchSchema,
  avatarUploadSchema,
  accountDeleteSchema,
  MAX_AVATAR_BYTES,
  ALLOWED_AVATAR_MIMES,
} from './schema';

interface LocalUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

// Value written by resolveLocalUserId()/ensureUserExists before the token's
// claims were threaded through — never a real address.
const PLACEHOLDER_EMAIL_SUFFIX = '@placeholder.local';
const DEFAULT_FULL_NAME = 'User';

interface LocalIdentity {
  email?: string;
  name?: string;
}

// Claims Supabase puts on the access token. They are the only source of truth
// for a provider-owned email and the OAuth display name.
function identityFromAuth(auth: AuthJWTPayload): LocalIdentity {
  const meta = auth.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
  const claim = meta?.full_name ?? meta?.name;
  return { email: auth.email, name: typeof claim === 'string' ? claim : undefined };
}

async function findUser(sub: string): Promise<LocalUser | null> {
  return db.user.findUnique({
    where: { supabaseUserId: sub },
    select: { id: true, email: true, fullName: true, avatarUrl: true },
  });
}

// Repairs a row that was provisioned without the token's profile (the GitHub
// OAuth path creates users through resolveLocalUserId, which has no identity
// to hand). Only the placeholder/default values are overwritten, so a name the
// user typed themselves is never clobbered.
async function healUser(user: LocalUser, identity: LocalIdentity): Promise<LocalUser> {
  const data: { email?: string; fullName?: string } = {};
  if (identity.email && user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
    data.email = identity.email;
  }
  if (identity.name && user.fullName === DEFAULT_FULL_NAME) {
    data.fullName = identity.name;
  }
  if (Object.keys(data).length === 0) return user;
  return db.user.update({
    where: { id: user.id },
    data,
    select: { id: true, email: true, fullName: true, avatarUrl: true },
  });
}

// Mirrors the ensure helpers in ai-history/dashboard: the settings read/write
// paths self-heal a missing local row instead of hard-404ing on first access.
async function ensureUser(auth: AuthJWTPayload): Promise<LocalUser> {
  const identity = identityFromAuth(auth);
  const existing = await findUser(auth.sub);
  if (existing) return healUser(existing, identity);
  await db.user.create({
    data: {
      supabaseUserId: auth.sub,
      email: identity.email || `${auth.sub}${PLACEHOLDER_EMAIL_SUFFIX}`,
      fullName: identity.name || DEFAULT_FULL_NAME,
    },
  });
  const created = await findUser(auth.sub);
  if (!created) throw new Error('Failed to provision user');
  return created;
}

async function getOrCreateSettings(userId: string) {
  // Upsert (not find-then-create): concurrent first reads raced into P2002.
  return db.userSettings.upsert({ where: { userId }, update: {}, create: { userId } });
}

function toSettingsResponse(user: LocalUser, s: Record<string, unknown>) {
  return {
    profile: {
      name: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      timezone: s.timezone,
    },
    ai: {
      defaultProvider: s.defaultProvider,
      defaultModel: s.defaultModel,
      temperature: s.temperature,
      maxTokens: s.maxTokens,
      streamResponses: s.streamResponses,
      markdownOutput: s.markdownOutput,
      autoScroll: s.autoScroll,
      autoCopy: s.autoCopy,
      defaultReviewType: s.defaultReviewType,
      defaultReviewDepth: s.defaultReviewDepth,
    },
    github: {
      defaultRepository: s.defaultRepository,
      defaultBranch: s.defaultBranch,
    },
    appearance: {
      theme: s.theme,
      compactMode: s.compactMode,
      fontSize: s.fontSize,
      accentColor: s.accentColor,
    },
    notifications: {
      notifyReviewComplete: s.notifyReviewComplete,
      notifyPrAnalysis: s.notifyPrAnalysis,
      notifyRepositorySync: s.notifyRepositorySync,
      notifyGithubAlerts: s.notifyGithubAlerts,
      notifyWeeklySummary: s.notifyWeeklySummary,
    },
  };
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer; ext: string } {
  const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Invalid data URL');
  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  return { mime, buffer, ext };
}

async function supabaseStorageRequest(
  method: string,
  path: string,
  body: Buffer | null,
  contentType?: string,
): Promise<Response> {
  const env = getEnv();
  const url = `${env.SUPABASE_URL}/storage/v1/${path}`;
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: body ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
}

async function ensureAvatarBucket(): Promise<void> {
  const env = getEnv();
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'avatars', public: true, fileSizeLimit: 5242880 }),
    signal: AbortSignal.timeout(10_000),
  });
  // 409 = already exists, which is fine.
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to ensure avatar bucket (${res.status}): ${text}`);
  }
}

async function deleteAvatarObject(path: string): Promise<void> {
  try {
    const res = await supabaseStorageRequest('DELETE', `object/avatars/${path}`, null);
    // 404 = already gone, fine.
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw new Error(`Failed to delete avatar object (${res.status}): ${text}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Failed to delete')) throw err;
    // Network errors during cleanup are non-fatal for the DB update path.
  }
}

const AVATAR_OBJECT_NAME = 'avatar';

async function currentSessionId(auth: AuthJWTPayload): Promise<string | null> {
  const sid = (auth as Record<string, unknown>).session_id;
  return typeof sid === 'string' ? sid : null;
}

export async function settingsRoutes(app: FastifyInstance) {
  // GET /settings — merged profile + all persisted sections (upsert-on-read).
  app.get('/settings', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
    const user = await ensureUser(auth);
    const settings = await getOrCreateSettings(user.id);
    return reply.send({ success: true, ...toSettingsResponse(user, settings) });
  });

  // PATCH /settings/profile
  app.patch(
    '/settings/profile',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = profilePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile settings',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);
      // Name (User.fullName) and timezone (UserSettings.timezone) live in two
      // tables; update them atomically so a partial write never leaves the two
      // out of sync.
      const [, settings] = await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: parsed.data.name !== undefined ? { fullName: parsed.data.name } : {},
        }),
        db.userSettings.upsert({
          where: { userId: user.id },
          update: { timezone: parsed.data.timezone },
          create: { userId: user.id, timezone: parsed.data.timezone },
        }),
      ]);
      const updatedUser =
        parsed.data.name !== undefined ? { ...user, fullName: parsed.data.name } : user;
      return reply.send({ success: true, ...toSettingsResponse(updatedUser, settings) });
    },
  );

  // PATCH /settings/ai
  app.patch(
    '/settings/ai',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = aiPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid AI settings',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);
      const settings = await db.userSettings.upsert({
        where: { userId: user.id },
        update: parsed.data,
        create: { userId: user.id, ...parsed.data },
      });
      return reply.send({ success: true, ...toSettingsResponse(user, settings) });
    },
  );

  // PATCH /settings/github
  app.patch(
    '/settings/github',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = githubPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid GitHub settings',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);
      const settings = await db.userSettings.upsert({
        where: { userId: user.id },
        update: parsed.data,
        create: { userId: user.id, ...parsed.data },
      });
      return reply.send({ success: true, ...toSettingsResponse(user, settings) });
    },
  );

  // PATCH /settings/appearance
  app.patch(
    '/settings/appearance',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = appearancePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid appearance settings',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);
      const settings = await db.userSettings.upsert({
        where: { userId: user.id },
        update: parsed.data,
        create: { userId: user.id, ...parsed.data },
      });
      return reply.send({ success: true, ...toSettingsResponse(user, settings) });
    },
  );

  // PATCH /settings/notifications
  app.patch(
    '/settings/notifications',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = notificationsPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid notification settings',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);
      const settings = await db.userSettings.upsert({
        where: { userId: user.id },
        update: parsed.data,
        create: { userId: user.id, ...parsed.data },
      });
      return reply.send({ success: true, ...toSettingsResponse(user, settings) });
    },
  );

  // POST /settings/avatar — base64 image upload to Supabase Storage.
  app.post(
    '/settings/avatar',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      // The body is JSON wrapping a base64 data URL (~4/3 of the raw bytes).
      bodyLimit: Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 1024,
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = avatarUploadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid avatar payload',
            details: parsed.error.issues,
          },
        });
      }
      const user = await ensureUser(auth);

      let decoded: { mime: string; buffer: Buffer; ext: string };
      try {
        decoded = parseDataUrl(parsed.data.dataUrl);
      } catch {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Malformed image data' },
        });
      }
      if (!ALLOWED_AVATAR_MIMES.has(decoded.mime)) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Unsupported image type' },
        });
      }
      if (decoded.buffer.length > MAX_AVATAR_BYTES) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Image exceeds 2MB limit' },
        });
      }

      const env = getEnv();
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return reply.status(500).send({
          success: false,
          error: { code: 'CONFIGURATION_ERROR', message: 'Avatar storage is not configured' },
        });
      }

      try {
        await ensureAvatarBucket();
        const objectPath = `${user.id}/${AVATAR_OBJECT_NAME}.${decoded.ext}`;
        const res = await supabaseStorageRequest(
          'POST',
          `object/avatars/${objectPath}`,
          decoded.buffer,
          decoded.mime,
        );
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          app.log.error({ status: res.status, text }, 'Avatar upload failed');
          return reply.status(502).send({
            success: false,
            error: { code: 'STORAGE_ERROR', message: 'Failed to store avatar' },
          });
        }
        const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/avatars/${objectPath}`;
        const previousUrl = user.avatarUrl;
        const updated = await db.user.update({
          where: { id: user.id },
          data: { avatarUrl: publicUrl },
          select: { id: true, email: true, fullName: true, avatarUrl: true },
        });
        // Best-effort: drop the previous object when its path differs (the
        // extension follows the uploaded image type) so switching formats
        // doesn't leak storage objects.
        if (previousUrl?.includes('/object/public/avatars/')) {
          const previousPath = previousUrl.split('/object/public/avatars/')[1];
          if (previousPath && previousPath !== objectPath) {
            await deleteAvatarObject(previousPath).catch(() => undefined);
          }
        }
        const settings = await getOrCreateSettings(user.id);
        return reply.send({ success: true, ...toSettingsResponse(updated, settings) });
      } catch (err) {
        app.log.error({ err }, 'Avatar upload error');
        return reply.status(502).send({
          success: false,
          error: { code: 'STORAGE_ERROR', message: 'Failed to store avatar' },
        });
      }
    },
  );

  // DELETE /settings/avatar
  app.delete(
    '/settings/avatar',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const user = await findUser(auth.sub);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }
      if (user.avatarUrl?.includes('/storage/v1/object/')) {
        try {
          const u = new URL(user.avatarUrl);
          const parts = u.pathname.split('/object/public/avatars/');
          if (parts[1]) await deleteAvatarObject(parts[1]);
        } catch {
          // best-effort cleanup
        }
      }
      const updated = await db.user.update({
        where: { id: user.id },
        data: { avatarUrl: null },
        select: { id: true, email: true, fullName: true, avatarUrl: true },
      });
      const settings = await getOrCreateSettings(user.id);
      return reply.send({ success: true, ...toSettingsResponse(updated, settings) });
    },
  );

  // GET /settings/account-sessions — reads Supabase auth.sessions (same Postgres).
  app.get('/settings/account-sessions', { preHandler: [authenticate] }, async (request, reply) => {
    const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
    const currentSid = await currentSessionId(auth);
    try {
      const rows = await db.$queryRaw<
        Array<{
          id: string;
          created_at: Date;
          updated_at: Date;
          user_agent: string | null;
          ip: string | null;
        }>
      >`
          SELECT s.id, s.created_at, s.updated_at, s.user_agent, s.ip
          FROM auth.sessions s
          JOIN auth.users u ON s.user_id = u.id
          WHERE u.id = ${auth.sub}::uuid
          ORDER BY s.updated_at DESC
        `;
      return reply.send({
        success: true,
        supported: true,
        currentSessionId: currentSid,
        sessions: rows.map((r) => ({
          id: r.id,
          createdAt: r.created_at?.toISOString?.() ?? null,
          updatedAt: r.updated_at?.toISOString?.() ?? null,
          userAgent: r.user_agent,
          ip: r.ip,
          current: r.id === currentSid,
        })),
      });
    } catch (err) {
      // auth schema may not be reachable from this role — degrade gracefully.
      request.log.warn({ err }, 'Session listing unavailable');
      return reply.send({
        success: true,
        supported: false,
        currentSessionId: currentSid,
        sessions: [],
      });
    }
  });

  // POST /settings/account-sessions/revoke-others — deletes all but current session.
  app.post(
    '/settings/account-sessions/revoke-others',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const currentSid = await currentSessionId(auth);
      if (!currentSid) {
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_SESSION', message: 'Current session could not be identified' },
        });
      }
      try {
        const result = await db.$executeRaw`
          DELETE FROM auth.sessions
          WHERE user_id = ${auth.sub}::uuid AND id != ${currentSid}::uuid
        `;
        return reply.send({ success: true, revoked: Number(result) });
      } catch (err) {
        request.log.warn({ err }, 'Session revoke unavailable');
        return reply.status(501).send({
          success: false,
          error: { code: 'UNSUPPORTED', message: 'Session management is unavailable' },
        });
      }
    },
  );

  // POST /settings/account/delete-challenge — binds a signed cookie to the
  // pre-authentication session so a later DELETE proves re-authentication.
  app.post(
    '/settings/account/delete-challenge',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      await ensureUser(auth);
      const sid = await currentSessionId(auth);
      if (!sid) {
        // Without a session id the challenge could never prove re-auth (a
        // null sid would differ from any later sid) — fail closed.
        return reply.status(400).send({
          success: false,
          error: { code: 'MISSING_SESSION', message: 'Current session could not be identified' },
        });
      }
      const payload = JSON.stringify({ uid: auth.sub, sid, ts: Date.now() });
      reply.setCookie('account_delete_challenge', payload, {
        path: '/',
        httpOnly: true,
        secure: true,
        signed: true,
        sameSite: 'none',
        maxAge: 600,
      });
      return reply.send({ success: true });
    },
  );

  // DELETE /settings/account — requires the challenge cookie AND a different
  // session_id than the one that created the challenge (proves re-login).
  app.delete(
    '/settings/account',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const auth = (request as FastifyRequest & { auth: AuthJWTPayload }).auth;
      const parsed = accountDeleteSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: parsed.error.issues,
          },
        });
      }
      const raw = request.cookies?.account_delete_challenge;
      const unsigned = raw ? request.unsignCookie(raw) : null;
      if (!unsigned?.value) {
        return reply.status(400).send({
          success: false,
          error: { code: 'CHALLENGE_REQUIRED', message: 'Start the delete flow first' },
        });
      }
      let challenge: { uid?: string; sid?: string };
      try {
        challenge = JSON.parse(unsigned.value);
      } catch {
        return reply.status(400).send({
          success: false,
          error: { code: 'CHALLENGE_INVALID', message: 'Invalid delete challenge' },
        });
      }
      if (challenge.uid !== auth.sub) {
        return reply.status(400).send({
          success: false,
          error: { code: 'CHALLENGE_MISMATCH', message: 'Challenge belongs to a different user' },
        });
      }
      const currentSid = await currentSessionId(auth);
      if (!currentSid || currentSid === challenge.sid) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'REAUTH_REQUIRED',
            message: 'Sign out and sign back in to confirm deletion',
          },
        });
      }

      const user = await findUser(auth.sub);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      // Best-effort avatar cleanup, then delete local rows (cascade handles
      // UserSettings, Notification, and other user-scoped tables).
      if (user.avatarUrl?.includes('/storage/v1/object/')) {
        try {
          const u = new URL(user.avatarUrl);
          const parts = u.pathname.split('/object/public/avatars/');
          if (parts[1]) await deleteAvatarObject(parts[1]);
        } catch {
          // best-effort
        }
      }
      // Delete the Supabase auth user BEFORE the local row (404 = already
      // gone). If it fails while storage is configured, abort so the account
      // can't resurrect as an empty shell after sign-in.
      const env = getEnv();
      if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${auth.sub}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok && res.status !== 404) {
            app.log.warn({ status: res.status }, 'Supabase auth user deletion failed');
            return reply.status(502).send({
              success: false,
              error: { code: 'AUTH_DELETE_FAILED', message: 'Could not delete auth account' },
            });
          }
        } catch (err) {
          app.log.warn({ err }, 'Supabase auth user deletion failed');
          return reply.status(502).send({
            success: false,
            error: { code: 'AUTH_DELETE_FAILED', message: 'Could not delete auth account' },
          });
        }
      } else {
        app.log.warn('Supabase admin credentials not configured; deleting local user only');
      }
      await db.user.delete({ where: { id: user.id } });

      reply.clearCookie('account_delete_challenge', { path: '/' });
      return reply.send({ success: true });
    },
  );
}
