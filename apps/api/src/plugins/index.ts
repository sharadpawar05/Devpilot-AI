import type { FastifyInstance } from 'fastify';
import { registerCors } from './cors';
import { registerHelmet } from './helmet';
import { registerSwagger } from './swagger';
import { registerErrorHandler } from './error-handler';
import { registerRequestLogger } from './request-logger';
import { registerAuth } from './auth';

export async function registerPlugins(app: FastifyInstance) {
  await registerErrorHandler(app);
  await registerRequestLogger(app);
  await registerCors(app);
  await registerHelmet(app);
  await registerSwagger(app);
  await registerAuth(app);
}
