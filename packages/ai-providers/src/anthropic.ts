export class AnthropicProvider {
  constructor(_config: { apiKey: string; defaultModel?: string }) {}

  async generate(_prompt: string): Promise<string> {
    throw new Error('Anthropic provider not yet implemented');
  }
}
