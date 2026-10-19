import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { httpRequestsTotal, httpRequestDurationSeconds, resolveRouteLabel } from '@/core/metrics';
import { REQUEST_ID_HEADER } from '@/core/http/server-options';
import { enterRequestContext } from './context';

/**
 * Query parameters whose values must never appear in logs. The GitHub OAuth
 * authorization `code` is a short-lived credential, and `state` enables
 * replay of an in-flight OAuth flow.
 */
const SENSITIVE_QUERY_PARAMS = new Set([
  'code',
  'state',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'client_secret',
  'apikey',
  'api_key',
  'key',
  'password',
  'secret',
  'signature',
]);

export function redactUrl(url: string): string {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) {
    return url;
  }
  const path = url.slice(0, qIndex);
  const query = url.slice(qIndex + 1);
  const params = query.split('&').map((pair) => {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      return pair;
    }
    const name = pair.slice(0, eqIndex);
    let decodedName = name;
    try {
      decodedName = decodeURIComponent(name);
    } catch {
      // Keep the raw name when it is not valid percent-encoding.
    }
    return SENSITIVE_QUERY_PARAMS.has(decodedName.toLowerCase()) ? `${name}=[redacted]` : pair;
  });
  return `${path}?${params.join('&')}`;
}

export async function registerRequestLogger(app: FastifyInstance) {
  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    (request as FastifyRequest & { startTime: number }).startTime = Date.now();
    // Bind the correlation ID for the whole async scope of this request so
    // module-level loggers (rootLogger) can attach it too.
    enterRequestContext(request.id);
    // Echo the correlation ID so clients and proxies can join a response to
    // server logs without parsing bodies.
    reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const { method } = request;
    const url = redactUrl(request.url);
    const { statusCode } = reply;
    const durationMs = Date.now() - (request as FastifyRequest & { startTime: number }).startTime;
    const route = resolveRouteLabel(request.routeOptions?.url);

    httpRequestsTotal.inc({ method, route, status: statusCode });
    httpRequestDurationSeconds.observe({ method, route }, durationMs / 1000);

    // `request.log` is Fastify's per-request child logger: it carries the
    // request ID binding, so this line is correlatable with error logs.
    request.log.info({ method, url, statusCode, durationMs, route }, 'request completed');

    done();
  });
}
