import { describe, it, expect, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const upsert = vi.fn();
const updateMany = vi.fn();

vi.mock('@/core/db', () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => findUnique(...args) },
    repositoryIndex: {
      upsert: (...args: unknown[]) => upsert(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
    },
  },
  checkDatabaseConnection: vi.fn(),
  getDb: vi.fn(),
}));

import { repositoryCache, INDEXING_STALE_MS } from '@/features/repository-chat/cache';

describe('RepositoryCache.claimIndexing', () => {
  beforeEach(() => {
    findUnique.mockReset().mockResolvedValue({ id: 'db-user-1' });
    upsert.mockReset().mockResolvedValue({});
    updateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it('claims a fresh repository (no prior INDEXING row)', async () => {
    const claimed = await repositoryCache.claimIndexing('supa-1', 'octo', 'api', 'main');

    expect(claimed).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_owner_repo_branch: {
            userId: 'db-user-1',
            owner: 'octo',
            repo: 'api',
            branch: 'main',
          },
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'db-user-1',
          owner: 'octo',
          repo: 'api',
          branch: 'main',
          OR: [{ status: { not: 'INDEXING' } }, { updatedAt: { lt: expect.any(Date) } }],
        }),
        data: { status: 'INDEXING', errorMessage: null },
      }),
    );
  });

  it('returns false when another request holds a fresh claim', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const claimed = await repositoryCache.claimIndexing('supa-1', 'octo', 'api', 'main');

    expect(claimed).toBe(false);
    // No second write path — the conditional updateMany is the only mutation.
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('uses the stale cutoff of 15 minutes so crashed workers can be taken over', async () => {
    const before = Date.now();
    await repositoryCache.claimIndexing('supa-1', 'octo', 'api', 'main');
    const after = Date.now();

    const where = updateMany.mock.calls[0][0].where;
    const cutoff: Date = where.OR[1].updatedAt.lt;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - INDEXING_STALE_MS - 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - INDEXING_STALE_MS + 1000);
    expect(INDEXING_STALE_MS).toBe(15 * 60_000);
  });

  it('throws when the user row does not exist (ownership scoping)', async () => {
    findUnique.mockResolvedValue(null);

    await expect(repositoryCache.claimIndexing('missing', 'octo', 'api', 'main')).rejects.toThrow(
      'User not found',
    );
    expect(updateMany).not.toHaveBeenCalled();
  });
});
