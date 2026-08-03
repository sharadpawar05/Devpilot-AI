import { useState, useCallback } from 'react';
import type { FixResult } from '@/components/ai/fix-mode/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface FixModeOptions {
  code: string;
  language: string;
  reviewContext?: string;
  provider?: string;
  model?: string;
}

interface UseFixModeReturn {
  isLoading: boolean;
  error: string | null;
  result: FixResult | null;
  provider: string;
  model: string;
  latencyMs: number;
  generateFixes: (options: FixModeOptions) => Promise<void>;
  reset: () => void;
}

function parseFixResult(raw: string): FixResult {
  const trimmed = raw.trim();

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { summary: 'Failed to parse AI response', fixes: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary || 'Fixes generated',
      fixes: Array.isArray(parsed.fixes)
        ? parsed.fixes.map((f: Record<string, unknown>) => ({
            severity: ['error', 'warning', 'info'].includes(f.severity as string)
              ? f.severity
              : 'info',
            location: String(f.location || 'Unknown'),
            description: String(f.description || 'Issue'),
            explanation: String(f.explanation || ''),
            confidence: typeof f.confidence === 'number' ? f.confidence : 0.5,
            originalCode: String(f.originalCode || ''),
            fixedCode: String(f.fixedCode || ''),
            diff: String(f.diff || ''),
          }))
        : [],
    };
  } catch {
    return { summary: 'Failed to parse AI response as JSON', fixes: [] };
  }
}

export function useFixMode(): UseFixModeReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FixResult | null>(null);
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [latencyMs, setLatencyMs] = useState(0);

  const generateFixes = useCallback(async (options: FixModeOptions) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/ai/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: options.code,
          language: options.language,
          reviewContext: options.reviewContext,
          provider: options.provider ?? 'gemini',
          model: options.model,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to generate fixes');
      }

      setProvider(data.provider);
      setModel(data.model);
      setLatencyMs(data.latencyMs);

      const parsed = parseFixResult(data.response);
      setResult(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setResult(null);
    setProvider('');
    setModel('');
    setLatencyMs(0);
  }, []);

  return {
    isLoading,
    error,
    result,
    provider,
    model,
    latencyMs,
    generateFixes,
    reset,
  };
}
