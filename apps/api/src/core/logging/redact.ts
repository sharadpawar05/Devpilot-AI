/**
 * Log redaction.
 *
 * Two complementary layers keep secrets, tokens and private repository
 * content out of logs:
 *
 * 1. `redactString` scrubs secret-shaped substrings (provider API keys, GitHub
 *    tokens, bearer credentials, JWTs, connection strings, `key=` query
 *    params) from any string before it is written.
 * 2. `redactDeep` additionally drops values of sensitive *field names* so a
 *    structured log call can never leak a prompt, a token header or source
 *    code even if the caller passes it directly.
 *
 * The redactor is wired into the pino logger as `formatters.log` (all fields)
 * and as the `err` serializer (error messages/stacks), so every log line is
 * covered by default — not just the ones we remembered to sanitize.
 */

/** Field names whose values are never written to logs. */
const SENSITIVE_FIELDS = new Set(
  [
    // credentials / transport
    'authorization',
    'cookie',
    'set-cookie',
    'password',
    'passwd',
    'secret',
    'client_secret',
    'clientsecret',
    'apikey',
    'api_key',
    'access_token',
    'accesstoken',
    'refresh_token',
    'refreshtoken',
    'id_token',
    'idtoken',
    'token',
    'githubaccesstoken',
    'sessionid',
    'session',
    // AI payloads — prompts and provider output can embed private code
    'prompt',
    'systemprompt',
    'userprompt',
    'rawprompt',
    'messages',
    'rawresponse',
    'completion',
    'content',
    // private repository content
    'sourcecode',
    'source',
    'filecontents',
    'filecontent',
    'files',
    'tree',
    'readme',
    'diff',
    'patch',
  ].map((f) => f.toLowerCase()),
);

/**
 * Secret-shaped substrings. Each pattern replaces the whole match with
 * `[redacted]` so no partial token survives.
 */
const SECRET_PATTERNS: RegExp[] = [
  // Provider API keys
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{16,}\b/g,
  // GitHub tokens
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  // Slack / Stripe style
  /\bxox[a-z]-[A-Za-z0-9-]{10,}/g,
  /\bwhsec_[A-Za-z0-9]{16,}\b/g,
  // Bearer / Basic credentials
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{16,}/gi,
  // JWTs (Supabase access tokens are JWTs)
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // Connection strings with credentials
  /\b(?:postgres(?:ql)?|mysql|redis|mongodb|amqp|smtp):\/\/[^\s"'@]+:[^\s"'@]+@[^\s"']+/gi,
  // Secret-ish query parameters in URLs that escaped redactUrl
  /([?&](?:key|access_token|token|api_key|apikey|client_secret|password|secret|signature)=)[^&\s"']+/gi,
];

/** Longest string kept in a log field before truncation (limits content leaks). */
const MAX_LOGGED_STRING = 1000;

export function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    // Fresh regex state per pass: these patterns are shared/global.
    pattern.lastIndex = 0;
    out = out.replace(pattern, (_match, prefix?: string) =>
      // Parameter-style patterns keep the `?key=` prefix for debuggability.
      typeof prefix === 'string' && prefix.length > 0 ? `${prefix}[redacted]` : '[redacted]',
    );
  }
  if (out.length > MAX_LOGGED_STRING) {
    out = `${out.slice(0, MAX_LOGGED_STRING)}…[truncated ${out.length - MAX_LOGGED_STRING} chars]`;
  }
  return out;
}

function isSensitiveField(name: string): boolean {
  return SENSITIVE_FIELDS.has(name.toLowerCase());
}

/**
 * Recursively redacts strings and drops sensitive fields. Cycle-safe and
 * depth-bounded so logging a tangled object can never hang the request.
 */
export function redactDeep(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `${value}`;
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const extra = value as { code?: unknown; statusCode?: unknown; status?: unknown };
    return {
      type: value.name,
      message: redactString(value.message),
      stack: redactString(value.stack ?? ''),
      code: redactDeep(extra.code, depth + 1, seen),
      statusCode: extra.statusCode ?? extra.status,
    };
  }
  if (value instanceof Map) {
    return redactDeep(Object.fromEntries(value), depth + 1, seen);
  }
  if (value instanceof Set) {
    return redactDeep([...value], depth + 1, seen);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (depth >= 6) return '[depth-limit]';
    return value.slice(0, 50).map((item) => redactDeep(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (depth >= 6) return '[depth-limit]';
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveField(key)) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = redactDeep(val, depth + 1, seen);
    }
    return out;
  }
  return String(value);
}

/**
 * Redaction pass for pino's `formatters.log`. The `err` key is left for the
 * `err` serializer so pino's standard error shape is preserved.
 */
export function redactLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'err' && val instanceof Error) {
      out[key] = val;
      continue;
    }
    if (isSensitiveField(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = redactDeep(val);
  }
  return out;
}
