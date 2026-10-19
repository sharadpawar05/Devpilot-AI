import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

vi.mock('@/core/db', () => ({
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
  getDb: vi.fn(),
  db: {},
}));

import { metricsRoutes, renderWorkflowMetrics } from '@/routes/metrics';
import { registry, httpRequestsTotal } from '@/core/metrics';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await metricsRoutes(app);
  await app.ready();
  return app;
}

describe('GET /metrics', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    httpRequestsTotal.inc({ method: 'GET', route: '/health', status: 200 });
  });

  it('responds in Prometheus text format with registered metric families', async () => {
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');

    const body = response.body;
    expect(body).toContain('# HELP http_requests_total');
    expect(body).toContain('# TYPE http_requests_total counter');
    expect(body).toContain('http_requests_total{method="GET",route="/health",status="200"}');
    expect(body).toContain('http_request_duration_seconds_bucket');
    expect(body).toContain('# TYPE ai_requests_total counter');
    expect(body).toContain('# TYPE background_jobs_total counter');
    expect(body).toContain('# TYPE ai_credits_consumed_total counter');
  });

  it('includes workflow addendum metrics', async () => {
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.body).toContain('ai_workflow_executions_total');
  });

  it('never exports high-cardinality labels (user, repo, prompt)', async () => {
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.body).not.toMatch(/user(Id)?="/);
    expect(response.body).not.toMatch(/prompt="/);
    expect(response.body).not.toMatch(/token="/);
  });
});

describe('renderWorkflowMetrics', () => {
  it('renders even when no workflow executions were recorded', () => {
    const output = renderWorkflowMetrics();
    expect(output).toContain('ai_workflow_executions_total');
    expect(output).toContain('ai_workflow_latency_seconds_sum');
  });
});

describe('registry isolation', () => {
  it('exposes a shared registry instance', async () => {
    const metrics = await import('@/core/metrics');
    expect(metrics.registry).toBe(registry);
  });
});
