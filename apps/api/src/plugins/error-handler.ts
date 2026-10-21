import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { sanitizeError } from '@/core/errors/sanitize';

/**
 * Fallback error codes by HTTP status, used to normalize error bodies that
 * routes sent without an explicit `code`. Keeping this table here means every
 * `{ success: false, error: {...} }` response — present and future — has the
 * same shape: `{ code, message, requestId }`.
 */
const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_ERROR',
  501: 'NOT_IMPLEMENTED',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

export function errorCodeForStatus(statusCode: number): string {
  if (STATUS_CODE_MAP[statusCode]) return STATUS_CODE_MAP[statusCode];
  return statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
}

interface ErrorBody {
  success: false;
  error: { code?: string; message?: string; requestId?: string };
}

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;
    const exposedCode = (error as { code?: unknown; expose?: unknown }).code;
    const isExposed =
      (error as { expose?: unknown }).expose === true &&
      typeof exposedCode === 'string' &&
      exposedCode.length > 0;

    // Errors built to be shown to clients as-is (rate limiter, explicit
    // `expose: true` errors): keep their code and message verbatim.
    if (isExposed) {
      request.log.warn({ err: error, statusCode }, 'Request rejected');
      return reply.status(statusCode).send({
        success: false,
        error: { code: exposedCode, message: error.message, requestId: request.id },
      });
    }

    // Fastify schema validation failures (JSON Schema `pattern`, required
    // params, etc.) — keep the standard API error shape and surface the
    // validation message (contains no internal details or secrets).
    if (error.validation && statusCode === 400) {
      request.log.warn({ err: error, statusCode }, 'Request validation failed');
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          requestId: request.id,
        },
      });
    }

    // Full error stays server-side, on the request-scoped child logger so it
    // carries the request ID.
    request.log.error({ err: error, statusCode }, 'Unhandled request error');

    // Sanitize the error for client exposure (already logged above).
    const sanitized = sanitizeError(
      error,
      typeof error.code === 'string' && error.code ? error.code : 'INTERNAL_ERROR',
      'An unexpected error occurred.',
      statusCode,
      false,
    );

    return reply.status(sanitized.statusCode).send({
      success: false,
      error: {
        code: sanitized.code,
        message: sanitized.message,
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });

  /**
   * Normalizes every error body before it is serialized:
   * - adds `code` when a route forgot one (derived from the status code),
   * - guarantees `message` is a string,
   * - attaches `requestId` so clients can quote it in bug reports.
   *
   * Runs for object payloads only (SSE strings and pre-serialized bodies skip
   * it), and only rewrites bodies that already use the `{ success: false,
   * error: {...} }` envelope.
   */
  app.addHook(
    'preSerialization',
    (request: FastifyRequest, reply: FastifyReply, payload: unknown, done) => {
      if (
        payload !== null &&
        typeof payload === 'object' &&
        !Array.isArray(payload) &&
        (payload as ErrorBody).success === false &&
        typeof (payload as ErrorBody).error === 'object' &&
        (payload as ErrorBody).error !== null
      ) {
        const body = payload as ErrorBody;
        if (typeof body.error.code !== 'string' || body.error.code.length === 0) {
          body.error.code = errorCodeForStatus(reply.statusCode);
        }
        if (typeof body.error.message !== 'string') {
          body.error.message = 'Request failed';
        }
        if (body.error.requestId === undefined) {
          body.error.requestId = request.id;
        }
      }
      done(null, payload);
    },
  );
}
