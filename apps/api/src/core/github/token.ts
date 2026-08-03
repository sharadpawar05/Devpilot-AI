import { Octokit } from 'octokit';
import { db } from '@/core/db';
import { encrypt, decrypt } from '@/core/github/crypto';

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

export async function getOctokit(userId: string): Promise<Octokit> {
  const token = await getGitHubToken(userId);
  if (!token) {
    throw new Error('GitHub not connected. Please connect your GitHub account first.');
  }
  return new Octokit({ auth: token });
}
