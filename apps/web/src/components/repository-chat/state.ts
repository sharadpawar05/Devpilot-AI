export enum RepositoryChatState {
  DISCONNECTED = 'DISCONNECTED',
  NO_REPOSITORY = 'NO_REPOSITORY',
  INDEXING = 'INDEXING',
  READY = 'READY',
  CHATTING = 'CHATTING',
  ERROR = 'ERROR',
}

export interface RepositoryChatContext {
  state: RepositoryChatState;
  selectedRepoFullName: string;
  selectedBranch: string;
  owner: string;
  repo: string;
  isIndexed: boolean;
  isIndexing: boolean;
  isChatting: boolean;
  errorMessage: string | null;
  indexedFiles: number;
  indexedAt: string | null;
}

export function deriveChatState({
  ghConnected,
  selectedRepoFullName,
  isIndexing,
  isTreeReady,
  hasMessages,
  error,
}: {
  ghConnected: boolean;
  selectedRepoFullName: string;
  isIndexing: boolean;
  isTreeReady: boolean;
  hasMessages: boolean;
  error: string | null;
}): RepositoryChatState {
  if (!ghConnected) return RepositoryChatState.DISCONNECTED;
  if (isIndexing) return RepositoryChatState.INDEXING;
  if (!selectedRepoFullName) return RepositoryChatState.NO_REPOSITORY;
  if (!isTreeReady) return RepositoryChatState.NO_REPOSITORY;
  if (hasMessages) return RepositoryChatState.CHATTING;
  if (error) return RepositoryChatState.ERROR;
  return RepositoryChatState.READY;
}
