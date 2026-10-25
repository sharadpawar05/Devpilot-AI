import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'review_complete',
  'pr_analysis',
  'repo_sync',
  'github_alert',
  'weekly_summary',
] as const;

export const listNotificationsQuerySchema = z
  .object({
    unread: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const markReadParamSchema = z.object({ id: z.string().uuid() }).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
