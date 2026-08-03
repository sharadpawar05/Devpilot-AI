import type {
  WorkflowType,
  WorkflowMetrics,
  WorkflowTypeMetrics,
  ProviderMetrics,
  WorkflowResponse,
} from './types';
import type { AIProviderName } from '@devpilot/ai-providers';

class UsageMetrics {
  private totalExecutions = 0;
  private successCount = 0;
  private failureCount = 0;
  private totalLatencyMs = 0;
  private totalTokens = 0;
  private byWorkflowType = new Map<WorkflowType, WorkflowTypeMetrics>();
  private byProvider = new Map<AIProviderName, ProviderMetrics>();

  record(response: WorkflowResponse): void {
    this.totalExecutions++;
    this.totalLatencyMs += response.latencyMs;
    this.totalTokens += response.tokenUsage.total;

    if (response.success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }

    const typeMetrics = this.getOrCreateWorkflowTypeMetrics(response.workflowType);
    typeMetrics.totalExecutions++;
    typeMetrics.totalLatencyMs += response.latencyMs;
    typeMetrics.totalTokens += response.tokenUsage.total;
    if (response.success) {
      typeMetrics.successCount++;
    } else {
      typeMetrics.failureCount++;
    }

    const providerMetrics = this.getOrCreateProviderMetrics(response.provider);
    providerMetrics.totalExecutions++;
    providerMetrics.totalLatencyMs += response.latencyMs;
    providerMetrics.totalTokens += response.tokenUsage.total;
    if (response.success) {
      providerMetrics.successCount++;
    } else {
      providerMetrics.failureCount++;
    }
  }

  getMetrics(): WorkflowMetrics {
    const byWorkflowType: Record<WorkflowType, WorkflowTypeMetrics> = {} as Record<
      WorkflowType,
      WorkflowTypeMetrics
    >;
    for (const [key, value] of this.byWorkflowType) {
      byWorkflowType[key] = { ...value };
    }

    const byProvider: Record<AIProviderName, ProviderMetrics> = {} as Record<
      AIProviderName,
      ProviderMetrics
    >;
    for (const [key, value] of this.byProvider) {
      byProvider[key] = { ...value };
    }

    return {
      totalExecutions: this.totalExecutions,
      successCount: this.successCount,
      failureCount: this.failureCount,
      avgLatencyMs: this.totalExecutions > 0 ? this.totalLatencyMs / this.totalExecutions : 0,
      totalTokens: this.totalTokens,
      byWorkflowType,
      byProvider,
    };
  }

  getWorkflowTypeMetrics(type: WorkflowType): WorkflowTypeMetrics | undefined {
    const metrics = this.byWorkflowType.get(type);
    return metrics ? { ...metrics } : undefined;
  }

  getProviderMetrics(provider: AIProviderName): ProviderMetrics | undefined {
    const metrics = this.byProvider.get(provider);
    return metrics ? { ...metrics } : undefined;
  }

  reset(): void {
    this.totalExecutions = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.totalLatencyMs = 0;
    this.totalTokens = 0;
    this.byWorkflowType.clear();
    this.byProvider.clear();
  }

  private getOrCreateWorkflowTypeMetrics(type: WorkflowType): WorkflowTypeMetrics {
    let metrics = this.byWorkflowType.get(type);
    if (!metrics) {
      metrics = {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
      };
      this.byWorkflowType.set(type, metrics);
    }
    return metrics;
  }

  private getOrCreateProviderMetrics(provider: AIProviderName): ProviderMetrics {
    let metrics = this.byProvider.get(provider);
    if (!metrics) {
      metrics = {
        totalExecutions: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
      };
      this.byProvider.set(provider, metrics);
    }
    return metrics;
  }
}

export const usageMetrics = new UsageMetrics();
