import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

const checkDatabaseConnection = vi.fn();

vi.mock('@/core/db', () => ({
  checkDatabaseConnection: (...args: unknown[]) => checkDatabaseConnection(...args),
  getDb: vi.fn(),
  db: {},
}));

import { healthRoutes } from '@/routes/health';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await healthRoutes(app);
  await app.ready();
  return app;
}

describe('health routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    checkDatabaseConnection.mockReset().mockResolvedValue(true);
    app = await buildApp();
  });

  it('GET /health/live returns 200 without touching dependencies', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; uptimeSeconds: number };
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
    // Liveness must not probe the database — a DB outage cannot restart-loop the app.
    expect(checkDatabaseConnection).not.toHaveBeenCalled();
  });

  it('GET /health/ready returns 200 when the database is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; database: string };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(checkDatabaseConnection).toHaveBeenCalledTimes(1);
  });

  it('GET /health/ready returns 503 when the database is down', async () => {
    checkDatabaseConnection.mockResolvedValue(false);

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    const body = response.json() as { status: string; database: string };
    expect(body.status).toBe('unavailable');
    expect(body.database).toBe('disconnected');
  });

  it('GET /health keeps its combined semantics (503 degraded on DB failure)', async () => {
    checkDatabaseConnection.mockResolvedValue(false);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(503);
    const body = response.json() as { status: string };
    expect(body.status).toBe('degraded');
  });
});
