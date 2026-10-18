import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getEnv } from '@/config';

export interface AuthJWTPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const env = getEnv();
    const url = new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

export async function verifyToken(token: string): Promise<AuthJWTPayload> {
  const env = getEnv();
  const key = getJwks();
  const { payload } = await jwtVerify(token, key, {
    // Supabase access tokens are signed with asymmetric keys published in
    // the JWKS endpoint. Restricting algorithms blocks token confusion.
    algorithms: ['RS256', 'ES256'],
    // Only accept tokens minted for this project's Supabase instance and
    // the standard "authenticated" audience.
    issuer: `${env.SUPABASE_URL}/auth/v1`,
    audience: 'authenticated',
  });
  return payload as AuthJWTPayload;
}

function isTokenExpiredError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_JWT_EXPIRED'
  );
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload.sub) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token: missing subject',
        },
      });
    }

    (request as FastifyRequest & { auth: AuthJWTPayload }).auth = payload;
  } catch (error) {
    // Log the detailed verification failure server-side only. Raw JOSE/JWKS
    // error messages must never reach clients.
    request.log.warn({ err: error }, 'Authentication failed');

    const message = isTokenExpiredError(error)
      ? 'Token has expired. Please sign in again.'
      : 'Invalid or expired token';

    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    });
  }
}
