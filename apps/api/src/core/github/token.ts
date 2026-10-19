import { db } from '@/core/db';
import { getEnv } from '@/config';
import { encrypt, decrypt } from '@/core/github/crypto';
import { createGitHubClient } from '@/core/github/client';

export async function getGitHubToken(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { supabaseUserId: userId },
    select: { githubAccessToken: true },
  });
  if (!user?.githubAccessToken) return null;
  try {
    return decrypt(user.githubAccessToken);
  } catch {
    if (
      user.githubAccessToken.startsWith('gho_') ||
      user.githubAccessToken.startsWith('ghp_') ||
      user.githubAccessToken.startsWith('ghu_') ||
      user.githubAccessToken.startsWith('ghs_') ||
      user.githubAccessToken.startsWith('ghr_') ||
      user.githubAccessToken.startsWith('github_pat_')
    ) {
      return user.githubAccessToken;
    }
    return null;
  }
}

export async function setGitHubToken(
  userId: string,
  token: string,
  email?: string,
  name?: string,
  githubUser?: { id: number; login: string; avatar_url: string },
): Promise<void> {
  const encryptedToken = encrypt(token);
  const updateData: {
    githubAccessToken: string;
    githubUserId?: number;
    githubUsername?: string;
    githubAvatar?: string;
    githubConnectedAt?: Date;
  } = {
    githubAccessToken: encryptedToken,
  };

  if (githubUser) {
    updateData.githubUserId = githubUser.id;
    updateData.githubUsername = githubUser.login;
    updateData.githubAvatar = githubUser.avatar_url;
    updateData.githubConnectedAt = new Date();
  }

  await db.user.upsert({
    where: { supabaseUserId: userId },
    update: updateData,
    create: {
      supabaseUserId: userId,
      email: email || `${userId}@placeholder.local`,
      fullName: name || 'GitHub User',
      githubAccessToken: encryptedToken,
      githubUserId: githubUser?.id,
      githubUsername: githubUser?.login,
      githubAvatar: githubUser?.avatar_url,
      githubConnectedAt: githubUser ? new Date() : undefined,
    },
  });
}

export async function deleteGitHubToken(userId: string): Promise<void> {
  await db.user.update({
    where: { supabaseUserId: userId },
    data: { githubAccessToken: null },
  });
}

/**
 * Best-effort revocation of an OAuth token at GitHub so a disconnected
 * token cannot keep accessing the user's account. Local deletion must
 * proceed even when GitHub is unreachable.
 */
export async function revokeGitHubToken(token: string): Promise<void> {
  const env = getEnv();
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !token) return;
  try {
    await fetch(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ access_token: token }),
      signal: AbortSignal.timeout(5000),
    });
    // 204 = revoked, 404 = already invalid — both acceptable.
  } catch {
    // Best-effort: never block the local disconnect on a GitHub outage.
  }
}

export async function getOctokit(userId: string): Promise<ReturnType<typeof createGitHubClient>> {
  const token = await getGitHubToken(userId);
  if (!token) {
    throw new Error('GitHub not connected. Please connect your GitHub account first.');
  }
  return createGitHubClient(token);
}
