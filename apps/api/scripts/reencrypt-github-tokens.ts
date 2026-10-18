import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../src/core/github/crypto';

/**
 * Re-encrypts legacy plaintext GitHub OAuth tokens (stored before token
 * encryption shipped) using AES-256-GCM. Idempotent: values that already
 * decrypt successfully are left untouched.
 *
 * Run after setting ENCRYPTION_SECRET:
 *   pnpm --filter @devpilot/api tokens:reencrypt
 * Preview without writing:
 *   pnpm --filter @devpilot/api tokens:reencrypt -- --dry-run
 */

const PLAINTEXT_PREFIXES = ['gho_', 'ghp_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];

function isPlaintextToken(value: string): boolean {
  return PLAINTEXT_PREFIXES.some((prefix) => value.startsWith(prefix));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      where: { githubAccessToken: { not: null } },
      select: { id: true, supabaseUserId: true, githubAccessToken: true },
    });

    let encrypted = 0;
    let alreadyEncrypted = 0;
    let skipped = 0;

    for (const user of users) {
      const value = user.githubAccessToken;
      if (!value) continue;

      try {
        decrypt(value);
        alreadyEncrypted++;
        continue;
      } catch {
        // Not valid ciphertext — fall through to the plaintext check.
      }

      if (!isPlaintextToken(value)) {
        console.warn(
          `Skipping user ${user.supabaseUserId}: token is neither valid ciphertext nor a known plaintext prefix.`,
        );
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[dry-run] Would encrypt plaintext token for user ${user.supabaseUserId}`);
        encrypted++;
        continue;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { githubAccessToken: encrypt(value) },
      });
      console.log(`Re-encrypted token for user ${user.supabaseUserId}`);
      encrypted++;
    }

    console.log(
      `Done${dryRun ? ' (dry-run)' : ''}: ${encrypted} encrypted, ${alreadyEncrypted} already encrypted, ${skipped} skipped.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
