import type { AIProviderName } from '@devpilot/ai-providers';
import {
  GeminiProvider,
  OpenAIProvider,
  AnthropicProvider,
  OpenRouterProvider,
  GroqProvider,
} from '@devpilot/ai-providers';
import type { AIProvider, AIProviderConfig } from '@devpilot/ai-providers';

type ProviderConstructor = new () => AIProvider;

const PROVIDER_CONSTRUCTORS: Record<AIProviderName, ProviderConstructor> = {
  gemini: GeminiProvider,
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  openrouter: OpenRouterProvider,
  groq: GroqProvider,
};

export class ProviderFactory {
  private providers: Map<AIProviderName, AIProvider> = new Map();

  createProvider(name: AIProviderName): AIProvider {
    const existing = this.providers.get(name);
    if (existing) return existing;

    const Constructor = PROVIDER_CONSTRUCTORS[name];
    if (!Constructor) {
      throw new Error(`Unknown provider: ${name}`);
    }

    const provider = new Constructor();
    this.providers.set(name, provider);
    return provider;
  }

  createAndInitialize(name: AIProviderName, config: AIProviderConfig): AIProvider {
    const provider = this.createProvider(name);
    provider.initialize(config);
    return provider;
  }

  getProvider(name: AIProviderName): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): AIProviderName[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isAvailable())
      .map(([name]) => name);
  }

  getAllProviderNames(): AIProviderName[] {
    return Object.keys(PROVIDER_CONSTRUCTORS) as AIProviderName[];
  }

  clear(): void {
    this.providers.clear();
  }
}
