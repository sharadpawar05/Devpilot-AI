import { useAuth } from '@/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Authenticated fetch against the API (JSON + bearer token + credentials).
 * Shared by the settings and notifications React Query layers.
 */
export function useApiFetch() {
  const { session } = useAuth();
  const token = session?.accessToken;
  return async (path: string, init?: RequestInit): Promise<Response> => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    return res;
  };
}

export function unwrap<T>(res: Response): Promise<T> {
  return res.json().then((body: { success?: boolean; error?: { message?: string } } & T) => {
    if (!res.ok || body.success === false) {
      throw new Error(body.error?.message ?? `Request failed (${res.status})`);
    }
    return body;
  });
}
