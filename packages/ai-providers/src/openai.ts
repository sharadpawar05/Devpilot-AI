export class OpenAIProvider {
  constructor(_config: { apiKey: string; defaultModel?: string }) {}

  async generate(_prompt: string): Promise<string> {
    throw new Error('OpenAI provider not yet implemented');
  }
}
