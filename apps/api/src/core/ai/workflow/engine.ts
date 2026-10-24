import type {
  WorkflowType,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowConfig,
  WorkflowHistoryEntry,
  WorkflowMetrics,
  ContextBuilderFn,
  ResponseFormatterFn,
} from './types';
import type { AIProviderName, AIModel, AIStreamChunk } from '@devpilot/ai-providers';
import { buildContext, registerContextBuilder } from './context-builder';
import { buildPrompt } from './prompt-builder';
import { executeRequest } from './request-executor';
import { parseResponse } from './response-parser';
import { formatResponse, registerResponseFormatter } from './response-formatter';
import { historyService } from './history-service';
import { usageMetrics } from './usage-metrics';
import { getWorkflowConfig } from './workflows';
import { aiService } from '@/core/ai/service';

export class AIWorkflowEngine {
  private configs: Map<WorkflowType, WorkflowConfig>;

  constructor() {
    this.configs = new Map();
  }

  registerWorkflow(config: WorkflowConfig): void {
    this.configs.set(config.workflowType, config);
  }

  registerContextBuilder(workflowType: WorkflowType, builder: ContextBuilderFn): void {
    registerContextBuilder(workflowType, builder);
  }

  registerResponseFormatter(workflowType: WorkflowType, formatter: ResponseFormatterFn): void {
    registerResponseFormatter(workflowType, formatter);
  }

  getConfig(workflowType: WorkflowType): WorkflowConfig | undefined {
    return this.configs.get(workflowType) || getWorkflowConfig(workflowType);
  }

  async execute(request: WorkflowRequest): Promise<WorkflowResponse> {
    const config = this.getConfig(request.workflowType);

    const effectiveMaxTokens = request.maxTokens || config?.defaultMaxTokens || 2048;
    const effectiveTemperature = request.temperature || config?.defaultTemperature || 0.3;

    const enrichedContext = await buildContext(request.workflowType, request.context);

    const { systemPrompt, userPrompt } = buildPrompt(
      request.workflowType,
      enrichedContext,
      request.prompt,
    );

    // Single retry layer: the AI gateway already retries transient provider
    // errors. Wrapping executeRequest in another retry would multiply attempts.
    const result = await executeRequest(userPrompt, systemPrompt, {
      ...request,
      maxTokens: effectiveMaxTokens,
      temperature: effectiveTemperature,
    });

    let response: WorkflowResponse;

    if (result?.error) {
      response = parseResponse(null, request.workflowType, result.error);
    } else if (result?.response) {
      const parsed = parseResponse(result.response, request.workflowType, null);
      const formatted = formatResponse(request.workflowType, parsed.rawResponse, enrichedContext);
      response = {
        ...parsed,
        formattedResponse: formatted,
      };
    } else {
      response = parseResponse(null, request.workflowType, {
        code: 'NO_RESULT',
        message: 'No result returned from execution.',
        provider: request.provider,
      });
    }

    historyService.log(response, {
      ...request.metadata,
    });

    usageMetrics.record(response);

    return response;
  }

  async *executeStream(request: WorkflowRequest): AsyncIterable<AIStreamChunk> {
    const config = this.getConfig(request.workflowType);

    const effectiveMaxTokens = request.maxTokens || config?.defaultMaxTokens || 2048;
    const effectiveTemperature = request.temperature || config?.defaultTemperature || 0.3;

    const enrichedContext = await buildContext(request.workflowType, request.context);

    const { systemPrompt, userPrompt } = buildPrompt(
      request.workflowType,
      enrichedContext,
      request.prompt,
    );

    let accumulatedContent = '';
    let sawProviderMetadata = false;
    const startTime = Date.now();

    for await (const chunk of aiService.generateStream(userPrompt, systemPrompt, {
      provider: request.provider,
      model: request.model as never,
      temperature: effectiveTemperature,
      maxTokens: effectiveMaxTokens,
      signal: request.signal,
    })) {
      if (chunk.type === 'error') {
        yield chunk;
        return;
      }
      if (chunk.type === 'token' && chunk.content) {
        accumulatedContent += chunk.content;
      }
      // At most one metadata chunk may reach the client: if the provider
      // already emitted one, do not emit a second below.
      if (chunk.type === 'metadata') {
        sawProviderMetadata = true;
      }
      yield chunk;
    }

    const latencyMs = Date.now() - startTime;
    const formatted = formatResponse(request.workflowType, accumulatedContent, enrichedContext);

    const response: WorkflowResponse = {
      success: true,
      workflowType: request.workflowType,
      provider: request.provider,
      model: request.model as never,
      latencyMs,
      tokenUsage: { input: 0, output: accumulatedContent.length, total: accumulatedContent.length },
      formattedResponse: formatted,
      rawResponse: accumulatedContent,
      timestamp: new Date().toISOString(),
    };

    historyService.log(response, request.metadata);
    usageMetrics.record(response);

    if (sawProviderMetadata) {
      return;
    }

    yield {
      type: 'metadata',
      provider: request.provider,
      model: request.model as AIModel | undefined,
      tokens: response.tokenUsage,
      latencyMs,
    };
  }

  getHistory(options?: {
    workflowType?: WorkflowType;
    limit?: number;
    offset?: number;
  }): WorkflowHistoryEntry[] {
    return historyService.getHistory(options);
  }

  getMetrics(): WorkflowMetrics {
    return usageMetrics.getMetrics();
  }

  getWorkflowMetrics(workflowType: WorkflowType) {
    return usageMetrics.getWorkflowTypeMetrics(workflowType);
  }

  getProviderMetrics(provider: AIProviderName) {
    return usageMetrics.getProviderMetrics(provider);
  }
}

export const workflowEngine = new AIWorkflowEngine();
