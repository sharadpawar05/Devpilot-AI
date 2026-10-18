import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

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
  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const { method } = request;
    const url = redactUrl(request.url);
    const { statusCode } = reply;
    const duration = Date.now() - (request as FastifyRequest & { startTime: number }).startTime;

    app.log.info({
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
    });

    done();
  });

  app.addHook('onRequest', (request: FastifyRequest, _reply: FastifyReply, done) => {
    (request as FastifyRequest & { startTime: number }).startTime = Date.now();
    done();
  });
}
