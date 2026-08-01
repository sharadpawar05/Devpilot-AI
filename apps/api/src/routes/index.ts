import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { versionRoutes } from './version';
import { meRoutes } from './me';
import { aiRoutes } from './ai';
import { codeReviewRoutes } from './code-review';

export async function apiV1Routes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(versionRoutes);
  await app.register(meRoutes);
  await app.register(aiRoutes);
  await app.register(codeReviewRoutes);
}
