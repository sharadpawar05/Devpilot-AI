import type { RequestLogEntry, ProviderStatus, HealthStatus } from './types';

export class RequestLogger {
  private logs: RequestLogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: RequestLogEntry): void {
    this.logs.push(entry);

    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }
  }

  getRecent(count?: number): RequestLogEntry[] {
    if (count) return this.logs.slice(-count);
    return [...this.logs];
  }

  getStats(): {
    totalRequests: number;
    successRate: number;
    averageLatencyMs: number;
    totalCost: number;
    totalTokens: number;
  } {
    if (this.logs.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatencyMs: 0,
        totalCost: 0,
        totalTokens: 0,
      };
    }

    const successful = this.logs.filter((l) => l.success);
    const totalLatency = this.logs.reduce((sum, l) => sum + l.latencyMs, 0);
    const totalCost = this.logs.reduce((sum, l) => sum + l.costTotal, 0);
    const totalTokens = this.logs.reduce((sum, l) => sum + l.tokensInput + l.tokensOutput, 0);

    return {
      totalRequests: this.logs.length,
      successRate: successful.length / this.logs.length,
      averageLatencyMs: totalLatency / this.logs.length,
      totalCost,
      totalTokens,
    };
  }

  clear(): void {
    this.logs = [];
  }
}

export function buildProviderStatus(
  name: string,
  initialized: boolean,
  healthy: boolean,
  requestCount: number,
  errorCount: number,
  totalLatencyMs: number,
): ProviderStatus {
  return {
    provider: name as ProviderStatus['provider'],
    initialized,
    healthy,
    lastHealthCheck: healthy ? new Date() : null,
    requestCount,
    errorCount,
    totalLatencyMs,
  };
}

export function buildHealthStatus(providerStatuses: Record<string, ProviderStatus>): HealthStatus {
  const allHealthy = Object.values(providerStatuses).every((p) => !p.initialized || p.healthy);

  return {
    healthy: allHealthy,
    providers: providerStatuses as unknown as HealthStatus['providers'],
    timestamp: new Date(),
  };
}
