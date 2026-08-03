export interface FixItem {
  severity: 'error' | 'warning' | 'info';
  location: string;
  description: string;
  explanation: string;
  confidence: number;
  originalCode: string;
  fixedCode: string;
  diff: string;
}

export interface FixResult {
  summary: string;
  fixes: FixItem[];
}

export interface FixModeState {
  isLoading: boolean;
  error: string | null;
  result: FixResult | null;
  provider: string;
  model: string;
  latencyMs: number;
}
