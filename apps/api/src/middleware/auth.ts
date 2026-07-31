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
    const url = new URL(`${env.SUPABASE_URL}/.well-known/jwks.json`);
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

export async function verifyToken(token: string): Promise<AuthJWTPayload> {
  const key = getJwks();
  const { payload } = await jwtVerify(token, key, {
    algorithms: ['HS256', 'RS256', 'ES256'],
  });
  return payload as AuthJWTPayload;
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
    const message = error instanceof Error ? error.message : 'Token verification failed';

    request.log.warn({ err: error }, 'Authentication failed');

    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
      },
    });
  }
}
