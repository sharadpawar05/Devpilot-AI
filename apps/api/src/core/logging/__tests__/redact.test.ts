import { describe, it, expect } from 'vitest';
import { redactString, redactDeep, redactLogObject } from '@/core/logging/redact';

describe('redactString', () => {
  it('redacts provider API keys', () => {
    const redacted = redactString('key is sk-abcdefghijklmnop and AIzaSyD-not-real-key');
    expect(redacted).not.toContain('sk-abcdefghijklmnop');
    expect(redacted).not.toContain('AIzaSyD');
  });

  it('redacts GitHub tokens including fine-grained PATs', () => {
    const redacted = redactString(
      'token ghp_1234567890abcdefghij and github_pat_11ABCDEFG0abcdefghijklmnop and gho_abcdefghij1234567890abcd',
    );
    expect(redacted).not.toContain('ghp_1234567890');
    expect(redacted).not.toContain('github_pat_11ABCDEFG0');
    expect(redacted).not.toContain('gho_abcdefghij');
  });

  it('redacts bearer credentials and JWTs', () => {
    const redacted = redactString(
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR86 and Basic dXNlcjpwYXNzd29yZDEyMzQ1',
    );
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(redacted).not.toContain('dXNlcjpwYXNzd29yZDEyMzQ1');
    expect(redacted).not.toContain('Bearer');
  });

  it('redacts connection strings with credentials', () => {
    const redacted = redactString('connect postgres://user:dbpassword@host:5432/db now');
    expect(redacted).not.toContain('dbpassword');
    expect(redacted).not.toContain('postgres://user');
  });

  it('redacts secret query parameters', () => {
    const redacted = redactString(
      'https://example.com/cb?api_key=abc123secret&access_token=tok1234567890&keep=visible',
    );
    expect(redacted).not.toContain('abc123secret');
    expect(redacted).not.toContain('tok1234567890');
    expect(redacted).toContain('keep=visible');
  });

  it('redacts Slack and Stripe-style secrets', () => {
    const redacted = redactString('xoxb-1234567890-abcdef and whsec_abcdefghijklmnop');
    expect(redacted).not.toContain('xoxb-1234567890');
    expect(redacted).not.toContain('whsec_');
  });

  it('truncates very long strings to bound content leaks', () => {
    const long = `prefix ${'a'.repeat(5000)} suffix`;
    const redacted = redactString(long);
    expect(redacted.length).toBeLessThan(1200);
    expect(redacted).toContain('[truncated');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactString('GET /api/v1/health 200 in 12ms')).toBe('GET /api/v1/health 200 in 12ms');
  });
});

describe('redactDeep', () => {
  it('drops values of sensitive field names', () => {
    const out = redactDeep({
      prompt: 'private source code here',
      authorization: 'Bearer token1234567890abcd',
      tree: [{ path: 'src/index.ts' }],
      safe: 'visible',
    }) as Record<string, unknown>;

    expect(out.prompt).toBe('[redacted]');
    expect(out.authorization).toBe('[redacted]');
    expect(out.tree).toBe('[redacted]');
    expect(out.safe).toBe('visible');
  });

  it('is case-insensitive for field names', () => {
    const out = redactDeep({ Prompt: 'x', SYSTEMPROMPT: 'y', Access_Token: 'z' }) as Record<
      string,
      unknown
    >;
    expect(out.Prompt).toBe('[redacted]');
    expect(out.SYSTEMPROMPT).toBe('[redacted]');
    expect(out.Access_Token).toBe('[redacted]');
  });

  it('redacts secrets embedded in error messages and stacks', () => {
    const err = new Error('failed with key sk-abcdefghijklmnop123456');
    err.stack = 'Error: failed with key sk-abcdefghijklmnop123456\n    at run (file.ts:1:1)';
    const out = redactDeep(err) as { message: string; stack: string };
    expect(out.message).not.toContain('sk-');
    expect(out.stack).not.toContain('sk-');
    expect(out.stack).toContain('at run');
  });

  it('handles circular references without hanging', () => {
    const obj: Record<string, unknown> = { name: 'node' };
    obj.self = obj;
    const out = redactDeep(obj) as Record<string, unknown>;
    expect(out.name).toBe('node');
    expect(out.self).toBe('[circular]');
  });

  it('bounds deep nesting', () => {
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 10; i++) {
      deep = { child: deep };
    }
    const out = redactDeep(deep);
    expect(JSON.stringify(out)).toContain('[depth-limit]');
  });

  it('passes through primitives and dates', () => {
    expect(redactDeep(42)).toBe(42);
    expect(redactDeep(true)).toBe(true);
    expect(redactDeep(null)).toBe(null);
    expect(redactDeep(undefined)).toBe(undefined);
    expect(redactDeep(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('redactLogObject', () => {
  it('leaves Error values under `err` for the err serializer', () => {
    const err = new Error('boom sk-abcdefghijklmnop123456');
    const out = redactLogObject({ err, url: '/x' });
    expect(out.err).toBe(err);
    expect(out.url).toBe('/x');
  });

  it('redacts sensitive fields and nested secrets', () => {
    const out = redactLogObject({
      systemPrompt: 'you are a code assistant',
      detail: { access_token: 'ghp_1234567890abcdefghij', ok: true },
    }) as Record<string, unknown>;
    expect(out.systemPrompt).toBe('[redacted]');
    expect((out.detail as Record<string, unknown>).access_token).toBe('[redacted]');
    expect((out.detail as Record<string, unknown>).ok).toBe(true);
  });
});
