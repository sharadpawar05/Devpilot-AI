import type { FastifyInstance } from 'fastify';
import { authenticate } from '@/core/auth';
import { db } from '@/core/db';

async function ensureUserExists(sub: string, email?: string): Promise<void> {
  const existing = await db.user.findUnique({
    where: { supabaseUserId: sub },
    select: { id: true },
  });
  if (!existing) {
    await db.user.create({
      data: {
        supabaseUserId: sub,
        email: email || `${sub}@placeholder.local`,
        fullName: 'User',
      },
    });
  }
}

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
      const auth = (request as { auth: { sub: string; email?: string } }).auth;

      await ensureUserExists(auth.sub, auth.email);

      const user = await db.user.findUnique({
        where: { supabaseUserId: auth.sub },
        select: {
          githubUsername: true,
          githubAvatar: true,
          githubConnectedAt: true,
          githubAccessToken: true,
        },
      });

      if (!user) {
        return reply.send({
          success: true,
          github: {
            connected: false,
            username: null,
            avatar: null,
            connectedAt: null,
          },
          stats: { lastActivityAt: null },
          activity: [],
        });
      }

      const githubConnected = !!user.githubAccessToken;

      const recentActivity = await db.aIHistorySession
        .findMany({
          where: { user: { supabaseUserId: auth.sub } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            workflowType: true,
            title: true,
            provider: true,
            model: true,
            totalTokens: true,
            totalLatency: true,
            createdAt: true,
          },
        })
        .catch(() => []);

      return reply.send({
        success: true,
        github: {
          connected: githubConnected,
          username: user.githubUsername ?? null,
          avatar: user.githubAvatar ?? null,
          connectedAt: user.githubConnectedAt?.toISOString() ?? null,
        },
        stats: {
          // recentActivity is ordered by createdAt desc, so the first row is MAX(createdAt).
          lastActivityAt: recentActivity[0]?.createdAt?.toISOString() ?? null,
        },
        activity: recentActivity.map(
          (s: {
            id: string;
            workflowType: string;
            title: string;
            provider: string;
            model: string;
            totalTokens: number;
            totalLatency: number;
            createdAt: Date;
          }) => ({
            id: s.id,
            action: s.workflowType.toLowerCase(),
            resourceType: 'ai_session',
            label: s.title,
            provider: s.provider,
            model: s.model,
            tokens: s.totalTokens,
            latencyMs: s.totalLatency,
            createdAt: s.createdAt.toISOString(),
          }),
        ),
      });
    },
  );
}
