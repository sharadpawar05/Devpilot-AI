import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'devpilot_playground_';

export interface PersistedPlaygroundState {
  templateId: string;
  formValues: Record<string, string>;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable
  }
}

export function usePersistedState() {
  const [templateId, setTemplateId] = useState(() => load<string>('templateId', ''));
  const [formValues, setFormValues] = useState(() =>
    load<Record<string, string>>('formValues', {}),
  );
  const [provider, setProvider] = useState(() => load<string>('provider', 'gemini'));
  const [model, setModel] = useState(() => load<string>('model', 'gemini-3.5-flash'));
  const [temperature, setTemperature] = useState(() => load<number>('temperature', 0.7));
  const [maxTokens, setMaxTokens] = useState(() => load<number>('maxTokens', 2048));

  useEffect(() => {
    save('templateId', templateId);
  }, [templateId]);
  useEffect(() => {
    save('formValues', formValues);
  }, [formValues]);
  useEffect(() => {
    save('provider', provider);
  }, [provider]);
  useEffect(() => {
    save('model', model);
  }, [model]);
  useEffect(() => {
    save('temperature', temperature);
  }, [temperature]);
  useEffect(() => {
    save('maxTokens', maxTokens);
  }, [maxTokens]);

  const resetForm = useCallback(() => {
    setFormValues({});
  }, []);

  return {
    templateId,
    setTemplateId,
    formValues,
    setFormValues,
    provider,
    setProvider,
    model,
    setModel,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    resetForm,
  };
}
