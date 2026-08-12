import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a Supabase user ID to the local database User.id.
 * Creates the user record if it doesn't exist yet.
 */
export async function resolveLocalUserId(supabaseUserId: string): Promise<string> {
  const user = await db.user.upsert({
    where: { supabaseUserId },
    update: {},
    create: {
      supabaseUserId,
      email: `${supabaseUserId}@placeholder.local`,
      fullName: 'User',
    },
    select: { id: true },
  });
  return user.id;
}
