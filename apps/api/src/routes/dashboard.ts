import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/core/auth';
import { db } from '@/core/db';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get(
    '/dashboard',
    {
      preHandler: [authenticate],
      schema: {
        description: 'Get aggregated dashboard data',
        tags: ['dashboard'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const auth = (request as { auth: { sub: string } }).auth;

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: {
          githubUsername: true,
          githubAvatar: true,
          githubConnectedAt: true,
          githubAccessToken: true,
        },
      });

      const githubConnected = !!user?.githubAccessToken;

      const recentActivity = await db.auditLog
        .findMany({
          where: { organizationId: undefined },
          orderBy: { id: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            resourceType: true,
            metadata: true,
          },
        })
        .catch(() => []);

      return reply.send({
        success: true,
        github: {
          connected: githubConnected,
          username: user?.githubUsername ?? null,
          avatar: user?.githubAvatar ?? null,
          connectedAt: user?.githubConnectedAt?.toISOString() ?? null,
        },
        activity: recentActivity.map((a) => ({
          id: a.id,
          action: a.action,
          resourceType: a.resourceType,
          metadata: a.metadata,
        })),
      });
    },
  );
}
