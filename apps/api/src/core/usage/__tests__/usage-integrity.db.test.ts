import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { AI_CREDIT_COSTS } from '../credit-costs';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DATABASE_URL)('database integrity against a real Postgres', () => {
  let db: PrismaClient;
  let usageService: typeof import('../usage-service').usageService;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.DIRECT_URL = TEST_DATABASE_URL;
    const here = fileURLToPath(new URL('.', import.meta.url));
    const apiRoot = path.resolve(here, '../../../..');
    execSync('pnpm exec prisma migrate deploy', {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    ({ db } = await import('@/core/db'));
    ({ usageService } = await import('../usage-service'));
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  describe('ownership isolation', () => {
    it('one user never sees another user usage counters', async () => {
      const subA = randomUUID();
      const subB = randomUUID();

      const consumed = await usageService.consumeQuota(subA, 'CHAT_MESSAGE');
      expect(consumed.consumed).toBe(true);

      const summaryA = await usageService.getUsageSummary(subA);
      const summaryB = await usageService.getUsageSummary(subB);

      expect(summaryA.usage.chatMessages).toBe(1);
      expect(summaryB.usage.chatMessages).toBe(0);
      expect(summaryB.usage.aiCredits).toBe(0);
    });

    it('usage rows are only ever addressed by their owning userId', async () => {
      const localA = await usageService.resolveUserId(randomUUID());
      const localB = await usageService.resolveUserId(randomUUID());
      const rowA = await usageService.getOrCreateUsage(localA);

      const rowsForB = await db.userUsage.findMany({ where: { userId: localB } });
      expect(rowsForB.some((r) => r.id === rowA.id)).toBe(false);
    });
  });

  describe('uniqueness constraints', () => {
    it('rejects a duplicate (userId, periodStart) usage row', async () => {
      const localId = await usageService.resolveUserId(randomUUID());
      const row = await usageService.getOrCreateUsage(localId);

      await expect(
        db.userUsage.create({
          data: { userId: localId, periodStart: row.periodStart, periodEnd: row.periodEnd },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('rejects a duplicate repository activation row', async () => {
      const localId = await usageService.resolveUserId(randomUUID());
      const data = {
        userId: localId,
        owner: 'octo-org',
        repo: 'demo-repo',
        branch: 'main',
        commitSha: '',
        status: 'NOT_INDEXED' as const,
        tree: [],
        fileMetadata: [],
        languageBreakdown: {},
        stats: {},
      };

      await db.repositoryIndex.create({ data });
      await expect(db.repositoryIndex.create({ data })).rejects.toMatchObject({ code: 'P2002' });
    });

    it('concurrent getOrCreateUsage produces exactly one period row', async () => {
      const localId = await usageService.resolveUserId(randomUUID());

      await Promise.all(Array.from({ length: 10 }, () => usageService.getOrCreateUsage(localId)));

      const rows = await db.userUsage.count({ where: { userId: localId } });
      expect(rows).toBe(1);
    });
  });

  describe('concurrent usage updates', () => {
    it('exactly `limit` parallel consumeQuota calls succeed, never more', async () => {
      const sub = randomUUID();
      const limits = await usageService.getPlanLimitsForUser(sub);
      const parallel = 25;

      const results = await Promise.all(
        Array.from({ length: parallel }, () => usageService.consumeQuota(sub, 'CHAT_MESSAGE')),
      );

      const consumed = results.filter((r) => r.consumed);
      expect(consumed.length).toBe(limits.chatMessages);

      const summary = await usageService.getUsageSummary(sub);
      expect(summary.usage.chatMessages).toBe(limits.chatMessages);
      expect(summary.remaining.chatMessages).toBe(0);
    });

    it('parallel consumeWithCredits enforces the credit ceiling exactly', async () => {
      const sub = randomUUID();
      const limits = await usageService.getPlanLimitsForUser(sub);
      const creditCost = AI_CREDIT_COSTS.AI_REPORT;
      const parallel = Math.min(30, limits.aiCredits + 5);

      const results = await Promise.all(
        Array.from({ length: parallel }, () =>
          usageService.consumeWithCredits(sub, 'AI_REPORT', 'AI_REPORT'),
        ),
      );

      const consumed = results.filter((r) => r.consumed);
      expect(consumed.length).toBe(Math.min(parallel, limits.aiReports));

      const summary = await usageService.getUsageSummary(sub);
      expect(summary.usage.aiReports).toBe(consumed.length);
      expect(summary.usage.aiCredits).toBe(consumed.length * creditCost);
      expect(summary.usage.aiCredits).toBeLessThanOrEqual(limits.aiCredits);
    });
  });

  describe('orphan prevention and cascades', () => {
    it('rejects a usage row for a nonexistent user (FK)', async () => {
      const row = await db.userUsage.findFirst({ take: 1 });
      await expect(
        db.userUsage.create({
          data: { userId: randomUUID(), periodStart: row!.periodStart, periodEnd: row!.periodEnd },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('deleting a user removes their usage rows (no orphans)', async () => {
      const sub = randomUUID();
      const localId = await usageService.resolveUserId(sub);
      await usageService.consumeQuota(sub, 'CHAT_MESSAGE');

      await db.user.delete({ where: { id: localId } });

      expect(await db.userUsage.count({ where: { userId: localId } })).toBe(0);
      expect(await db.aIUsageEvent.count({ where: { userId: localId } })).toBe(0);
    });
  });

  describe('non-negative usage counter CHECK', () => {
    it('rejects writing a negative counter', async () => {
      const localId = await usageService.resolveUserId(randomUUID());
      const row = await usageService.getOrCreateUsage(localId);

      await expect(
        db.userUsage.update({
          where: { userId_periodStart: { userId: localId, periodStart: row.periodStart } },
          data: { aiCreditsUsed: -1 },
        }),
      ).rejects.toThrow(/violates check constraint/i);

      await expect(
        db.userUsage.create({
          data: {
            userId: localId,
            periodStart: new Date(2000, 0, 1),
            periodEnd: new Date(2000, 1, 1),
            chatMessagesUsed: -5,
          },
        }),
      ).rejects.toThrow(/violates check constraint/i);
    });
  });

  describe('organization/project consistency on ai_reports', () => {
    it('rejects a report whose project belongs to a different organization', async () => {
      const orgA = await db.organization.create({
        data: { name: `Org A ${randomUUID()}`, slug: `org-a-${randomUUID()}` },
      });
      const orgB = await db.organization.create({
        data: { name: `Org B ${randomUUID()}`, slug: `org-b-${randomUUID()}` },
      });
      const projectB = await db.project.create({
        data: { organizationId: orgB.id, name: 'Project of B' },
      });

      await expect(
        db.aIReport.create({
          data: {
            organizationId: orgA.id,
            projectId: projectB.id,
            type: 'PR_SUMMARY',
            title: 'Cross-org report',
            prompt: 'prompt',
            model: 'gemini-3.6-flash',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('accepts a report whose project belongs to the same organization', async () => {
      const org = await db.organization.create({
        data: { name: `Org ${randomUUID()}`, slug: `org-${randomUUID()}` },
      });
      const project = await db.project.create({
        data: { organizationId: org.id, name: 'Project of org' },
      });

      const report = await db.aIReport.create({
        data: {
          organizationId: org.id,
          projectId: project.id,
          type: 'PR_SUMMARY',
          title: 'Same-org report',
          prompt: 'prompt',
          model: 'gemini-3.6-flash',
        },
      });

      expect(report.id).toBeTruthy();
    });
  });

  describe('monthly reset', () => {
    it('a new UTC month starts at zero and is consumable even when last month was full', async () => {
      const sub = randomUUID();
      const localId = await usageService.resolveUserId(sub);
      const current = await usageService.getOrCreateUsage(localId);

      const prevStart = new Date(current.periodStart);
      prevStart.setUTCMonth(prevStart.getUTCMonth() - 1);
      const prevEnd = new Date(current.periodEnd);
      prevEnd.setUTCMonth(prevEnd.getUTCMonth() - 1);
      await db.userUsage.create({
        data: {
          userId: localId,
          periodStart: prevStart,
          periodEnd: prevEnd,
          chatMessagesUsed: 999,
        },
      });

      const summary = await usageService.getUsageSummary(sub);
      expect(summary.periodStart).toBe(current.periodStart.toISOString());
      expect(summary.usage.chatMessages).toBe(0);
      expect(summary.remaining.chatMessages).toBe(summary.limits.chatMessages);

      const consumed = await usageService.consumeQuota(sub, 'CHAT_MESSAGE');
      expect(consumed.consumed).toBe(true);
      expect(consumed.used).toBe(1);
    });
  });

  describe('failed requests and retries', () => {
    it('refund after a failed generation restores quota so a retry can consume', async () => {
      const sub = randomUUID();
      const limits = await usageService.getPlanLimitsForUser(sub);

      for (let i = 0; i < limits.aiReports; i++) {
        const r = await usageService.consumeQuota(sub, 'AI_REPORT');
        expect(r.consumed).toBe(true);
      }

      const atLimit = await usageService.consumeQuota(sub, 'AI_REPORT');
      expect(atLimit.allowed).toBe(false);
      expect(atLimit.details?.feature).toBe('AI_REPORT');
      expect(atLimit.details?.limit).toBe(limits.aiReports);
      expect(atLimit.details?.resetAt).toBeInstanceOf(Date);

      await usageService.refundQuota(sub, 'AI_REPORT');

      const retry = await usageService.consumeQuota(sub, 'AI_REPORT');
      expect(retry.consumed).toBe(true);

      const summary = await usageService.getUsageSummary(sub);
      expect(summary.usage.aiReports).toBe(limits.aiReports);
      expect(summary.remaining.aiReports).toBe(0);
    });

    it('refundWithCredits restores both dimensions together so a retry can consume again', async () => {
      const sub = randomUUID();

      const consumed = await usageService.consumeWithCredits(sub, 'AI_REPORT', 'AI_REPORT');
      expect(consumed.consumed).toBe(true);
      const afterFirst = await usageService.getUsageSummary(sub);
      expect(afterFirst.usage.aiReports).toBe(1);
      expect(afterFirst.usage.aiCredits).toBeGreaterThan(0);

      await usageService.refundWithCredits(sub, 'AI_REPORT', 'AI_REPORT');

      const afterRefund = await usageService.getUsageSummary(sub);
      expect(afterRefund.usage.aiReports).toBe(0);
      expect(afterRefund.usage.aiCredits).toBe(0);

      const again = await usageService.consumeWithCredits(sub, 'AI_REPORT', 'AI_REPORT');
      expect(again.consumed).toBe(true);
    });
  });
});
