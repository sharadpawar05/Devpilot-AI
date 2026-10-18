import { env } from './env';

const DEFAULT_TIMEOUT_MS = 5000;

export class AuthUnavailableError extends Error {
  constructor(message = 'Authentication service is unavailable') {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

export async function isAuthServiceReachable(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  if (!env.VITE_SUPABASE_URL) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
