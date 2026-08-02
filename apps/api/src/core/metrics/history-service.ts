import { randomUUID } from 'crypto';
import type {
  WorkflowType,
  WorkflowHistoryEntry,
  WorkflowResponse,
} from '@/core/ai/workflow/types';

const MAX_HISTORY_SIZE = 1000;

class HistoryService {
  private entries: WorkflowHistoryEntry[] = [];

  log(response: WorkflowResponse, metadata?: Record<string, unknown>): WorkflowHistoryEntry {
    const entry: WorkflowHistoryEntry = {
      id: randomUUID(),
      workflowType: response.workflowType,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
      success: response.success,
      errorMessage: response.error?.message,
      metadata,
      createdAt: new Date(),
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_HISTORY_SIZE) {
      this.entries = this.entries.slice(-MAX_HISTORY_SIZE);
    }

    return entry;
  }

  getHistory(options?: {
    workflowType?: WorkflowType;
    limit?: number;
    offset?: number;
  }): WorkflowHistoryEntry[] {
    let result = [...this.entries];

    if (options?.workflowType) {
      result = result.filter((e) => e.workflowType === options.workflowType);
    }

    result.reverse();

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    return result.slice(offset, offset + limit);
  }

  getHistoryEntry(id: string): WorkflowHistoryEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  clearHistory(): void {
    this.entries = [];
  }

  getStats(): {
    total: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
  } {
    const total = this.entries.length;
    if (total === 0) {
      return { total: 0, successCount: 0, failureCount: 0, avgLatencyMs: 0 };
    }

    const successCount = this.entries.filter((e) => e.success).length;
    const failureCount = total - successCount;
    const avgLatencyMs = this.entries.reduce((sum, e) => sum + e.latencyMs, 0) / total;

    return { total, successCount, failureCount, avgLatencyMs };
  }
}

export const historyService = new HistoryService();
