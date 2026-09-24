import type { EngineeringStatusRequest, EngineeringStatusResponse } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class EngineeringStatusApiError extends Error {
  code?: string;
  retryable?: boolean;

  constructor(message: string, code?: string, retryable?: boolean) {
    super(message);
    this.name = 'EngineeringStatusApiError';
    this.code = code;
    this.retryable = retryable ?? true;
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
    const message = errorBody?.error?.message || `Request failed with status ${res.status}`;
    throw new EngineeringStatusApiError(
      message,
      errorBody?.error?.code,
      errorBody?.error?.retryable,
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
