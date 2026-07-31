import type { AIGenerationRequest, AIGenerationResponse, AIModel } from '@devpilot/ai-providers';

export class AIRouter {
  async generate(_request: AIGenerationRequest): Promise<AIGenerationResponse> {
    throw new Error('AI Router not yet implemented');
  }

  selectModel(_criteria: {
    complexity: 'low' | 'medium' | 'high';
    contextLength: number;
    speed: 'fast' | 'balanced' | 'quality';
    cost: 'low' | 'medium' | 'high';
  }): AIModel {
    return 'gpt-4';
  }
}

export const aiRouter = new AIRouter();
