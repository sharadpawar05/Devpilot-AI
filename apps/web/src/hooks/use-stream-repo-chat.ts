import { useCallback, useRef } from 'react';
import { useAuth } from '@/auth';
import { useStreamSession } from './use-stream';
import { aiHistoryApi } from '@/lib/ai-history';
import { generateId } from '@/lib/id';

export interface StreamChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  usage?: { input: number; output: number; total: number };
  referencedFiles?: string[];
  treeSummary?: string;
  timestamp: Date;
}

export interface StreamRepoChatParams {
  owner: string;
  repo: string;
  branch: string;
  question: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  provider?: string;
  model?: string;
}

export function useStreamRepoChat() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const stream = useStreamSession();
  const messagesRef = useRef<StreamChatMessage[]>([]);

  const sendMessage = useCallback(
    async (params: StreamRepoChatParams) => {
      const userMsg: StreamChatMessage = {
        id: generateId(),
        role: 'user',
        content: params.question,
        timestamp: new Date(),
      };

      messagesRef.current = [...messagesRef.current, userMsg];

      return new Promise<StreamChatMessage>((resolve, reject) => {
        stream.startStream({
          workflowType: 'REPOSITORY_CHAT',
          provider: params.provider || 'gemini',
          model: params.model,
          prompt: params.question,
          context: {
            owner: params.owner,
            repo: params.repo,
            branch: params.branch,
            conversationHistory: params.conversationHistory || [],
          },
          onComplete: async (metadata, content) => {
            const assistantMsg: StreamChatMessage = {
              id: generateId(),
              role: 'assistant',
              content,
              provider: metadata?.provider || params.provider || 'gemini',
              model: metadata?.model || params.model || 'gemini-3.5-flash',
              latencyMs: metadata?.latencyMs || 0,
              usage: metadata?.tokens,
              timestamp: new Date(),
            };

            messagesRef.current = [...messagesRef.current, assistantMsg];

            if (token) {
              try {
                const allMessages = messagesRef.current;
                const userMessages = allMessages.filter((m) => m.role === 'user');
                const title =
                  userMessages.length > 0
                    ? userMessages[userMessages.length - 1].content.slice(0, 60) +
                      (userMessages[userMessages.length - 1].content.length > 60 ? '...' : '')
                    : 'Repository Chat';

                await aiHistoryApi.createSession(token, {
                  workflowType: 'repository-chat',
                  repository: `${params.owner}/${params.repo}`,
                  title,
                  provider: (metadata?.provider || params.provider || 'gemini') as never,
                  model: (metadata?.model || params.model || 'gemini') as never,
                  messages: allMessages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    latency: m.latencyMs || 0,
                    tokens: m.usage?.total || 0,
                    timestamp: m.timestamp.toISOString(),
                  })),
                });
              } catch {
                // History save failed
              }
            }

            resolve(assistantMsg);
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
    sendMessage,
    messages: messagesRef.current,
  };
}
