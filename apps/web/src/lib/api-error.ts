export type UsageFeature =
  'REPOSITORIES' | 'HEALTH_SCAN' | 'AI_REPORT' | 'CHAT_MESSAGE' | 'AI_CREDITS';

export interface UsageLimitDetails {
  feature: UsageFeature;
  used: number;
  limit: number;
  resetAt?: string;
  message?: string;
}

/** Structured API error that preserves the USAGE_LIMIT_REACHED envelope. */
export class ApiError extends Error {
  code?: string;
  retryable?: boolean;
  feature?: UsageFeature;
  used?: number;
  limit?: number;
  resetAt?: string;

  constructor(
    message: string,
    options: {
      code?: string;
      retryable?: boolean;
      feature?: string;
      used?: number;
      limit?: number;
      resetAt?: string;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.retryable = options.retryable ?? true;
    this.feature = options.feature as UsageFeature | undefined;
    this.used = options.used;
    this.limit = options.limit;
    this.resetAt = options.resetAt;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readErrorBody(err: unknown): {
  code?: string;
  message?: string;
  feature?: string;
  used?: number;
  limit?: number;
  resetAt?: string;
  retryable?: boolean;
} {
  const obj = asRecord(err);
  if (!obj) return {};

  // Prefer the deepest error-shaped object that still has usage fields,
  // otherwise fall back to any nested error, otherwise the object itself.
  const candidates: Array<Record<string, unknown>> = [];
  const push = (v: unknown) => {
    const r = asRecord(v);
    if (r) candidates.push(r);
  };
  push(asRecord(obj.response)?.error);
  push(asRecord(obj.response));
  push(obj.error);
  push(asRecord(obj.body)?.error);
  push(obj.body);
  push(obj);

  const pickString = (keys: string[]): string | undefined => {
    for (const c of candidates) {
      for (const k of keys) {
        if (typeof c[k] === 'string') return c[k] as string;
      }
    }
    return undefined;
  };
  const pickNumber = (keys: string[]): number | undefined => {
    for (const c of candidates) {
      for (const k of keys) {
        const v = c[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
          return Number(v);
        }
      }
    }
    return undefined;
  };
  const pickBoolean = (keys: string[]): boolean | undefined => {
    for (const c of candidates) {
      for (const k of keys) {
        if (typeof c[k] === 'boolean') return c[k] as boolean;
      }
    }
    return undefined;
  };

  return {
    code: pickString(['code']),
    message: pickString(['message']),
    feature: pickString(['feature']),
    used: pickNumber(['used']),
    limit: pickNumber(['limit']),
    resetAt: pickString(['resetAt']),
    retryable: pickBoolean(['retryable']),
  };
}

export function isUsageLimitError(error: unknown): boolean {
  if (!error) return false;
  const { code, message } = readErrorBody(error);
  if (code === 'USAGE_LIMIT_REACHED' || code === 'PLAN_LIMIT_REACHED') return true;
  // Fallback: message sometimes carries the only signal when code was dropped
  if (
    message &&
    /limit reached|includes \d+ .* per month|includes \d+ active repository/i.test(message)
  ) {
    return true;
  }
  return false;
}

function parseNumberFromMessage(
  message: string | undefined,
  kind: 'limit' | 'used',
): number | undefined {
  if (!message) return undefined;
  if (kind === 'limit') {
    // "Your plan includes 2 reports per month" / "includes 50 credits"
    const m =
      /includes\s+(\d+)/i.exec(message) ||
      /\(\s*\d+\s*\/\s*(\d+)\s*\)/i.exec(message) ||
      /limit\s*\(?(\d+)\)?/i.exec(message);
    return m ? Number(m[1]) : undefined;
  }
  const m = /\(\s*(\d+)\s*\/\s*\d+\s*\)/i.exec(message);
  return m ? Number(m[1]) : undefined;
}

export function getUsageLimitDetails(error: unknown): UsageLimitDetails | null {
  if (!isUsageLimitError(error)) return null;
  const { code, message, feature, used, limit, resetAt } = readErrorBody(error);

  const fallbackFeature: UsageFeature =
    message && /repository/i.test(message) && !/report/i.test(message)
      ? 'REPOSITORIES'
      : message && /health scan/i.test(message)
        ? 'HEALTH_SCAN'
        : message && /chat/i.test(message)
          ? 'CHAT_MESSAGE'
          : message && /credit/i.test(message)
            ? 'AI_CREDITS'
            : 'AI_REPORT';

  const resolvedLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? limit
      : parseNumberFromMessage(message, 'limit');

  let resolvedUsed =
    typeof used === 'number' && Number.isFinite(used) && used >= 0
      ? used
      : parseNumberFromMessage(message, 'used');

  // We only get here for usage-limit errors. If the envelope dropped `used`
  // but we recovered `limit`, the user is at/over the limit — show limit/limit.
  if (
    (resolvedUsed === undefined || resolvedUsed === 0) &&
    resolvedLimit !== undefined &&
    resolvedLimit > 0
  ) {
    resolvedUsed = resolvedLimit;
  }

  return {
    feature: (feature as UsageFeature | undefined) ?? fallbackFeature,
    used: resolvedUsed ?? 0,
    limit: resolvedLimit ?? 0,
    resetAt,
    message:
      message ||
      (code === 'USAGE_LIMIT_REACHED' ? 'You have reached your plan usage limit.' : undefined),
  };
}

/** Normalize any thrown error into ApiError, preserving usage-limit fields. */
export function toApiError(error: unknown, fallbackMessage: string): ApiError {
  if (error instanceof ApiError) return error;

  const { code, message, feature, used, limit, resetAt, retryable } = readErrorBody(error);
  const baseMessage = (error instanceof Error && error.message) || message || fallbackMessage;

  // Preserve .code on known error subclasses (EngineeringStatusApiError etc.)
  const anyErr = error as { code?: unknown } | null;
  const errCode = typeof anyErr?.code === 'string' ? anyErr.code : code;

  return new ApiError(baseMessage, {
    code: errCode,
    retryable,
    feature,
    used,
    limit,
    resetAt,
  });
}
