import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerRequestLogger(app: FastifyInstance) {
  app.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, done) => {
    const { method, url } = request;
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
