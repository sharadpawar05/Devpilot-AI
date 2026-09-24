import type { EngineeringStatusRequest, EngineeringStatusResponse } from './types';
import { ApiError, toApiError } from '@/lib/api-error';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class EngineeringStatusApiError extends ApiError {
  constructor(
    message: string,
    code?: string,
    retryable?: boolean,
    options: { feature?: string; used?: number; limit?: number; resetAt?: string } = {},
  ) {
    super(message, { code, retryable, ...options });
    this.name = 'EngineeringStatusApiError';
  }
}

async function authFetch(
  url: string,
  token?: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const err = errorBody?.error ?? {};
    throw new EngineeringStatusApiError(
      err.message || `Request failed with status ${res.status}`,
      err.code,
      err.retryable,
      {
        feature: err.feature,
        used: err.used,
        limit: err.limit,
        resetAt: err.resetAt,
      },
    );
  }
  return res;
}

export const engineeringStatusApi = {
  async generateReport(
    request: EngineeringStatusRequest,
    token?: string,
  ): Promise<EngineeringStatusResponse> {
    const res = await authFetch(`${API_BASE}/engineering-status/generate`, token, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return res.json();
  },
};

export { toApiError };
