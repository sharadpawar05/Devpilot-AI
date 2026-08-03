import { useState, useCallback } from 'react';
import { aiHistoryApi } from '@/lib/ai-history';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function pollForIndex(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000,
): Promise<RepoIndexResponse | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const statusRes = await fetch(
        `${API_BASE_URL}/repository-chat/status?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
        { headers: authHeaders(token), credentials: 'include' },
      );
      const statusData = await statusRes.json();
      if (statusData.status === 'READY' || statusData.indexed) {
        const treeRes = await fetch(
          `${API_BASE_URL}/repository-chat/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
          { headers: authHeaders(token), credentials: 'include' },
        );
        const treeData = await treeRes.json();
        if (treeData.success) {
          return {
            success: true,
            tree: treeData.tree,
            keyFiles: {},
            readme: '',
            packageJson: null,
            totalFiles: treeData.totalFiles,
            indexedAt: treeData.indexedAt,
          };
        }
      }
      if (statusData.status === 'FAILED') {
        return null;
      }
    } catch {
      // Continue polling
    }
  }
  return null;
}

export interface RepoFile {
  path: string;
  name: string;
  type: 'file' | 'dir';
  children?: RepoFile[];
  sha?: string;
  size?: number;
}

export interface RepoIndexResponse {
  success: boolean;
  cached?: boolean;
  tree: RepoFile[];
  keyFiles: Record<string, string>;
  readme: string;
  packageJson: Record<string, unknown> | null;
  totalFiles: number;
  indexedAt: string;
}

export interface ChatMessage {
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

export interface ChatResponse {
  success: boolean;
  response: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: { input: number; output: number; total: number };
  referencedFiles: string[];
  treeSummary: string;
}

export function useRepositoryChat(token: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [tree, setTree] = useState<RepoFile[]>([]);
  const [indexedFiles, setIndexedFiles] = useState(0);
  const [indexedAt, setIndexedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const indexRepository = useCallback(
    async (owner: string, repo: string, branch: string) => {
      if (!token) return null;
      setIsIndexing(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/repository-chat/index`, {
          method: 'POST',
          headers: authHeaders(token),
          credentials: 'include',
          body: JSON.stringify({ owner, repo, branch }),
        });
        const data = await res.json();
        if (data.success) {
          if (data.cached && data.tree) {
            setTree(data.tree);
            setIndexedFiles(data.totalFiles);
            setIndexedAt(data.indexedAt);
            setIsIndexing(false);
            return data;
          }
          if (data.status === 'INDEXING') {
            const result = await pollForIndex(owner, repo, branch, token);
            if (result) {
              setTree(result.tree);
              setIndexedFiles(result.totalFiles);
              setIndexedAt(result.indexedAt);
              return result;
            }
            setError('Indexing timed out or failed. Please try again.');
            return null;
          }
          if (data.tree) {
            setTree(data.tree);
            setIndexedFiles(data.totalFiles);
            setIndexedAt(data.indexedAt);
            setIsIndexing(false);
            return data;
          }
        }
        setError('Failed to index repository');
        return null;
      } catch {
        setError('Failed to connect to server');
        return null;
      } finally {
        setIsIndexing(false);
      }
    },
    [token],
  );

  const sendMessage = useCallback(
    async (
      owner: string,
      repo: string,
      branch: string,
      question: string,
      provider: string = 'gemini',
      model?: string,
    ) => {
      if (!token) return null;
      setIsChatting(true);
      setError(null);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const res = await fetch(`${API_BASE_URL}/repository-chat/chat`, {
          method: 'POST',
          headers: authHeaders(token),
          credentials: 'include',
          body: JSON.stringify({
            owner,
            repo,
            branch,
            question,
            conversationHistory,
            provider,
            model,
          }),
        });
        const data: ChatResponse = await res.json();
        if (data.success) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.response,
            provider: data.provider,
            model: data.model,
            latencyMs: data.latencyMs,
            usage: data.usage,
            referencedFiles: data.referencedFiles,
            treeSummary: data.treeSummary,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);

          const allMessages = [...messages, userMsg, assistantMsg];
          const userMessages = allMessages.filter((m) => m.role === 'user');
          const title =
            userMessages.length > 0
              ? userMessages[userMessages.length - 1].content.slice(0, 60) +
                (userMessages[userMessages.length - 1].content.length > 60 ? '...' : '')
              : 'Repository Chat';

          if (token) {
            await aiHistoryApi.createSession(token, {
              workflowType: 'repository-chat',
              repository: `${owner}/${repo}`,
              title,
              provider: (data.provider || provider) as never,
              model: (data.model || model || 'gemini') as never,
              messages: allMessages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                latency: m.latencyMs || 0,
                tokens: m.usage?.total || 0,
                timestamp: m.timestamp.toISOString(),
              })),
            });
          }

          return assistantMsg;
        }
        setError(data.success === false ? 'Failed to get response' : 'Unknown error');
        return null;
      } catch {
        setError('Failed to connect to server');
        return null;
      } finally {
        setIsChatting(false);
      }
    },
    [token, messages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const loadFromHistory = useCallback(
    (historyMessages: Array<{ role: string; content: string; timestamp: string }>) => {
      const loadedMessages: ChatMessage[] = historyMessages.map((m) => ({
        id: crypto.randomUUID(),
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));
      setMessages(loadedMessages);
    },
    [],
  );

  const checkStatus = useCallback(
    async (owner: string, repo: string, branch: string) => {
      if (!token) return null;
      try {
        const res = await fetch(
          `${API_BASE_URL}/repository-chat/status?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
          {
            headers: authHeaders(token),
            credentials: 'include',
          },
        );
        return await res.json();
      } catch {
        return null;
      }
    },
    [token],
  );

  return {
    messages,
    isIndexing,
    isChatting,
    tree,
    indexedFiles,
    indexedAt,
    error,
    indexRepository,
    sendMessage,
    clearMessages,
    checkStatus,
    loadFromHistory,
  };
}
