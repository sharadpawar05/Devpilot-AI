import type { FastifyInstance } from 'fastify';
import { registry } from '@/core/metrics';
import { usageMetrics } from '@/core/ai/workflow/usage-metrics';

const PROMETHEUS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

/**
 * Renders the in-process workflow metrics (from `usageMetrics`) as an
 * addendum to the registry output, so AI executions recorded by the workflow
 * engine are scrapeable without a second mechanism.
 */
export function renderWorkflowMetrics(): string {
  const metrics = usageMetrics.getMetrics();
  const lines: string[] = [];

  lines.push('# HELP ai_workflow_executions_total AI workflow executions by type and outcome.');
  lines.push('# TYPE ai_workflow_executions_total counter');
  for (const [workflow, typeMetrics] of Object.entries(metrics.byWorkflowType)) {
    lines.push(
      `ai_workflow_executions_total{workflow="${workflow}",outcome="success"} ${typeMetrics.successCount}`,
    );
    lines.push(
      `ai_workflow_executions_total{workflow="${workflow}",outcome="error"} ${typeMetrics.failureCount}`,
    );
  }

  lines.push('# HELP ai_workflow_latency_seconds_sum Total AI workflow latency in seconds.');
  lines.push('# TYPE ai_workflow_latency_seconds_sum counter');
  const totalLatencyMs = Object.values(metrics.byWorkflowType).reduce(
    (sum, typeMetrics) => sum + typeMetrics.totalLatencyMs,
    0,
  );
  lines.push(`ai_workflow_latency_seconds_sum ${totalLatencyMs / 1000}`);
  lines.push('# HELP ai_workflow_latency_seconds_count AI workflow executions counted.');
  lines.push('# TYPE ai_workflow_latency_seconds_count counter');
  lines.push(`ai_workflow_latency_seconds_count ${metrics.totalExecutions}`);

  lines.push('# HELP ai_provider_executions_total AI executions by provider and outcome.');
  lines.push('# TYPE ai_provider_executions_total counter');
  for (const [provider, providerMetrics] of Object.entries(metrics.byProvider)) {
    lines.push(
      `ai_provider_executions_total{provider="${provider}",outcome="success"} ${providerMetrics.successCount}`,
    );
    lines.push(
      `ai_provider_executions_total{provider="${provider}",outcome="error"} ${providerMetrics.failureCount}`,
    );
  }

  return lines.join('\n');
}

export async function metricsRoutes(app: FastifyInstance) {
  /**
   * Prometheus-style metrics: request latency/failures, AI calls, credit
   * consumption and estimated provider cost, background jobs.
   *
   * Only aggregate counters with bounded labels are exported — no user IDs,
   * repositories or prompts. The metrics path is also exempt from rate
   * limiting (scrapers poll it).
   */
  app.get(
    '/metrics',
    {
      config: { rateLimit: false },
      schema: {
        description:
          'Process metrics (Prometheus text format): request latency/failures, AI usage, credits, costs',
        tags: ['system'],
      },
    },
    async (_request, reply) =>
      reply
        .type(PROMETHEUS_CONTENT_TYPE)
        .send(`${registry.render()}\n${renderWorkflowMetrics()}\n`),
  );
}
