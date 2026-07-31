import type { AIProviderName, AIProviderConfig } from '@devpilot/ai-providers';

export interface GatewayConfig {
  defaultProvider: AIProviderName;
  providers: Partial<Record<AIProviderName, AIProviderConfig>>;
  globalTimeout: number;
  globalRetryMaxAttempts: number;
  enableRequestLogging: boolean;
}

export interface ProviderStatus {
  provider: AIProviderName;
  initialized: boolean;
  healthy: boolean;
  lastHealthCheck: Date | null;
  requestCount: number;
  errorCount: number;
  totalLatencyMs: number;
}

export interface HealthStatus {
  healthy: boolean;
  providers: Record<AIProviderName, ProviderStatus>;
  timestamp: Date;
}

export interface RequestLogEntry {
  id: string;
  provider: AIProviderName;
  model: string;
  timestamp: Date;
  latencyMs: number;
  success: boolean;
  tokensInput: number;
  tokensOutput: number;
  costTotal: number;
  errorCode?: string;
  retryAttempt?: number;
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  defaultProvider: 'gemini',
  providers: {},
  globalTimeout: 60000,
  globalRetryMaxAttempts: 3,
  enableRequestLogging: true,
};
