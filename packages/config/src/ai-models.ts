/**
 * Centralized AI Model Configuration
 *
 * This file contains all supported models and provider configurations.
 * All parts of the codebase should import from this file instead of defining models locally.
 */

export type AIProviderName = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export interface AIModelConfig {
  id: string;
  name: string;
  provider: AIProviderName;
  maxTokens: number;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  contextWindow: number;
  isActive: boolean;
}

export interface AIProviderConfig {
  name: AIProviderName;
  label: string;
  defaultModel: string;
  models: AIModelConfig[];
}

/**
 * All supported AI models
 */
export const AI_MODELS: Record<string, AIModelConfig> = {
  // Gemini Models
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsJsonMode: true,
    contextWindow: 1000000,
    isActive: true,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsJsonMode: true,
    contextWindow: 1000000,
    isActive: true,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'gemini',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsJsonMode: true,
    contextWindow: 1000000,
    isActive: true,
  },
  // OpenAI Models
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsJsonMode: true,
    contextWindow: 128000,
    isActive: true,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsJsonMode: true,
    contextWindow: 128000,
    isActive: true,
  },
  // Anthropic Models
  'claude-sonnet-4-20250514': {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsJsonMode: false,
    contextWindow: 200000,
    isActive: true,
  },
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    maxTokens: 8192,
    supportsStreaming: true,
    supportsJsonMode: false,
    contextWindow: 200000,
    isActive: true,
  },
  // OpenRouter Models
  auto: {
    id: 'auto',
    name: 'Auto (Best Available)',
    provider: 'openrouter',
    maxTokens: 4096,
    supportsStreaming: true,
    supportsJsonMode: false,
    contextWindow: 128000,
    isActive: true,
  },
} as const;

/**
 * Provider configurations
 */
export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    name: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: Object.values(AI_MODELS).filter((m) => m.provider === 'gemini' && m.isActive),
  },
  {
    name: 'openai',
    label: 'OpenAI',
    defaultModel: 'gpt-4o',
    models: Object.values(AI_MODELS).filter((m) => m.provider === 'openai' && m.isActive),
  },
  {
    name: 'anthropic',
    label: 'Anthropic',
    defaultModel: 'claude-sonnet-4-20250514',
    models: Object.values(AI_MODELS).filter((m) => m.provider === 'anthropic' && m.isActive),
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'auto',
    models: Object.values(AI_MODELS).filter((m) => m.provider === 'openrouter' && m.isActive),
  },
];

/**
 * Get models for a specific provider
 */
export function getModelsForProvider(provider: AIProviderName): AIModelConfig[] {
  return AI_PROVIDERS.find((p) => p.name === provider)?.models || [];
}

/**
 * Get provider config by name
 */
export function getProviderConfig(provider: AIProviderName): AIProviderConfig | undefined {
  return AI_PROVIDERS.find((p) => p.name === provider);
}

/**
 * Get model config by ID
 */
export function getModelConfig(modelId: string): AIModelConfig | undefined {
  return AI_MODELS[modelId];
}

/**
 * Validate if a model is supported
 */
export function isModelSupported(modelId: string, provider: AIProviderName): boolean {
  const model = AI_MODELS[modelId];
  return model !== undefined && model.provider === provider && model.isActive;
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: AIProviderName): string {
  return getProviderConfig(provider)?.defaultModel || 'gemini-2.5-flash';
}

/**
 * Get provider-selectable options for UI
 */
export function getProviderOptions() {
  return AI_PROVIDERS.map((p) => ({
    value: p.name,
    label: p.label,
  }));
}

/**
 * Get model-selectable options for UI
 */
export function getModelOptions(provider: AIProviderName) {
  return getModelsForProvider(provider).map((m) => ({
    value: m.id,
    label: m.name,
  }));
}
