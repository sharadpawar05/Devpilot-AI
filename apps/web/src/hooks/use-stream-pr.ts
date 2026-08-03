import { useCallback } from 'react';
import { useAuth } from '@/auth';
import { useStreamSession } from './use-stream';
import { aiHistoryApi } from '@/lib/ai-history';
import { generateId } from '@/lib/id';

export interface StreamPRReviewParams {
  owner: string;
  repo: string;
  pull_number: number;
  files?: string[];
  reviewType?: string;
  reviewDepth?: string;
  provider?: string;
}

export interface StreamPRAnalyzeParams {
  owner: string;
  repo: string;
  pull_number: number;
  provider?: string;
}

export function useStreamPR() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const stream = useStreamSession();

  const reviewPR = useCallback(
    async (params: StreamPRReviewParams) => {
      return new Promise<{
        success: boolean;
        response: string;
        provider: string;
        model: string;
        latencyMs: number;
        usage: { input: number; output: number; total: number };
      }>((resolve, reject) => {
        stream.startStream({
          workflowType: 'PR_REVIEW',
          provider: params.provider || 'gemini',
          prompt: `Review PR #${params.pull_number}`,
          context: {
            owner: params.owner,
            repo: params.repo,
            pull_number: params.pull_number,
            files: params.files,
            reviewType: params.reviewType,
            reviewDepth: params.reviewDepth,
          },
          onComplete: async (metadata) => {
            if (token) {
              try {
                await aiHistoryApi.createSession(token, {
                  workflowType: 'pr-review',
                  repository: `${params.owner}/${params.repo}`,
                  title: `PR #${params.pull_number} Review`,
                  provider: (metadata?.provider || params.provider || 'gemini') as never,
                  model: (metadata?.model || 'gemini-2.0-flash') as never,
                  messages: [
                    {
                      id: generateId(),
                      role: 'user',
                      content: `Review PR #${params.pull_number} in ${params.owner}/${params.repo}`,
                      latency: 0,
                      tokens: 0,
                      timestamp: new Date().toISOString(),
                    },
                    {
                      id: generateId(),
                      role: 'assistant',
                      content: stream.content,
                      latency: metadata?.latencyMs || 0,
                      tokens: metadata?.tokens?.total || 0,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                });
              } catch {
                // History save failed
              }
            }

            resolve({
              success: true,
              response: stream.content,
              provider: metadata?.provider || params.provider || 'gemini',
              model: metadata?.model || 'gemini-2.0-flash',
              latencyMs: metadata?.latencyMs || 0,
              usage: metadata?.tokens || { input: 0, output: 0, total: 0 },
            });
          },
          onError: (error) => {
            reject(error);
          },
        });
      });
    },
    [stream, token],
  );

  const analyzePR = useCallback(
    async (params: StreamPRAnalyzeParams) => {
      return new Promise<{
        success: boolean;
        response: string;
        provider: string;
        model: string;
        latencyMs: number;
        truncated: boolean;
        fileTypes: string;
        usage: { input: number; output: number; total: number };
      }>((resolve, reject) => {
        stream.startStream({
          workflowType: 'PR_ANALYSIS',
          provider: params.provider || 'gemini',
          prompt: `Analyze PR #${params.pull_number}`,
          context: {
            owner: params.owner,
            repo: params.repo,
            pull_number: params.pull_number,
          },
          onComplete: async (metadata) => {
            if (token) {
              try {
                await aiHistoryApi.createSession(token, {
                  workflowType: 'pr-review',
                  repository: `${params.owner}/${params.repo}`,
                  title: `PR #${params.pull_number} Analysis`,
                  provider: (metadata?.provider || params.provider || 'gemini') as never,
                  model: (metadata?.model || 'gemini-2.0-flash') as never,
                  messages: [
                    {
                      id: generateId(),
                      role: 'user',
                      content: `Analyze PR #${params.pull_number} in ${params.owner}/${params.repo}`,
                      latency: 0,
                      tokens: 0,
                      timestamp: new Date().toISOString(),
                    },
                    {
                      id: generateId(),
                      role: 'assistant',
                      content: stream.content,
                      latency: metadata?.latencyMs || 0,
                      tokens: metadata?.tokens?.total || 0,
                      timestamp: new Date().toISOString(),
                    },
                  ],
                });
              } catch {
                // History save failed
              }
            }

            resolve({
              success: true,
              response: stream.content,
              provider: metadata?.provider || params.provider || 'gemini',
              model: metadata?.model || 'gemini-2.0-flash',
              latencyMs: metadata?.latencyMs || 0,
              truncated: false,
              fileTypes: '',
              usage: metadata?.tokens || { input: 0, output: 0, total: 0 },
            });
          },
          onError: (error) => {
            reject(error);
          },
        });
      });
    },
    [stream, token],
  );

  return {
    ...stream,
    reviewPR,
    analyzePR,
  };
}
