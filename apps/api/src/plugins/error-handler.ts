import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { sanitizeError } from '@/core/errors/sanitize';

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    const statusCode = error.statusCode || 500;

    // Log the full error server-side only
    app.log.error(error);

    // Fastify schema validation failures (JSON Schema `pattern`, required
    // params, etc.) — keep the standard API error shape and surface the
    // validation message (contains no internal details or secrets).
    if (error.validation && statusCode === 400) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    // Sanitize the error for client exposure
    const sanitized = sanitizeError(
      error,
      error.code || 'INTERNAL_ERROR',
      'An unexpected error occurred.',
      statusCode,
    );

    reply.status(sanitized.statusCode).send({
      success: false,
      error: {
        code: sanitized.code,
        message: sanitized.message,
      },
    });
  });

  app.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });
}
