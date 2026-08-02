import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { versionRoutes } from './version';
import { meRoutes } from './me';
import { dashboardRoutes } from './dashboard';
import { playgroundRoutes } from '@/features/playground';
import { codeReviewRoutes } from '@/features/code-review';
import { prReviewRoutes } from '@/features/pr-review';
import { githubRoutes } from '@/core/github';
import { repositoryChatRoutes, repositoryRoutes } from '@/features/repository-chat';

export async function apiV1Routes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(versionRoutes);
  await app.register(meRoutes);
  await app.register(dashboardRoutes);
  await app.register(playgroundRoutes);
  await app.register(codeReviewRoutes);
  await app.register(githubRoutes);
  await app.register(prReviewRoutes);
  await app.register(repositoryRoutes);
  await app.register(repositoryChatRoutes);
}
