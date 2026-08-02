import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useRepositoryChat } from '@/hooks/use-repository-chat';
import { RepositoryChatState, deriveChatState } from '@/components/repository-chat/state';
import { RepositoryChatLayout } from '@/components/repository-chat/RepositoryChatLayout';
import { DisconnectedState } from '@/components/repository-chat/DisconnectedState';
import { RepositorySelectionState } from '@/components/repository-chat/RepositorySelectionState';
import { RepositoryIndexingState } from '@/components/repository-chat/RepositoryIndexingState';
import { RepositoryReadyState } from '@/components/repository-chat/RepositoryReadyState';
import { ConversationState } from '@/components/repository-chat/ConversationState';
import { RepositoryErrorState } from '@/components/repository-chat/RepositoryErrorState';

export function RepositoryChatPage() {
  const { session } = useAuth();
  const gh = useGitHub();
  const chat = useRepositoryChat(session?.accessToken);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');

  const isIndexed = (chat.tree?.length ?? 0) > 0;

  const repoParts = selectedRepoFullName.split('/');
  const owner = repoParts[0] || '';
  const repo = repoParts[1] || '';

  const currentState = useMemo(
    () =>
      deriveChatState({
        ghConnected: gh.connected,
        selectedRepoFullName,
        isIndexing: chat.isIndexing,
        isTreeReady: isIndexed,
        hasMessages: (chat.messages?.length ?? 0) > 0,
        error: chat.error,
      }),
    [
      gh.connected,
      selectedRepoFullName,
      chat.isIndexing,
      isIndexed,
      chat.messages?.length ?? 0,
      chat.error,
    ],
  );

  const handleRepoSelect = useCallback((fullName: string) => {
    setSelectedRepoFullName(fullName);
    setSelectedBranch('main');
  }, []);

  const handleBranchSelect = useCallback((branch: string) => {
    setSelectedBranch(branch);
  }, []);

  const handleIndex = useCallback(
    (o: string, r: string, branch: string) => {
      chat.indexRepository(o, r, branch);
    },
    [chat.indexRepository],
  );

  const handleSend = useCallback(
    (question: string, provider: string) => {
      if (owner && repo) {
        chat.sendMessage(owner, repo, selectedBranch, question, provider);
      }
    },
    [owner, repo, selectedBranch, chat.sendMessage],
  );

  const handleFileClick = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  const handleConnect = useCallback(async () => {
    const url = await gh.connect('/repository-chat');
    if (url) window.location.href = url;
  }, [gh.connect]);

  const handleRetry = useCallback(() => {
    if (owner && repo) {
      chat.indexRepository(owner, repo, selectedBranch);
    }
  }, [owner, repo, selectedBranch, chat.indexRepository]);

  const handleChooseAnother = useCallback(() => {
    setSelectedRepoFullName('');
    setSelectedBranch('main');
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedRepoFullName('');
    setSelectedBranch('main');
  }, []);

  const sidebarProps = {
    gh,
    tree: chat.tree,
    indexedFiles: chat.indexedFiles,
    indexedAt: chat.indexedAt,
    isIndexing: chat.isIndexing,
    selectedRepoFullName,
    selectedBranch,
    onRepoSelect: handleRepoSelect,
    onBranchSelect: handleBranchSelect,
    onIndex: handleIndex,
    onFileSelect: handleFileClick,
    selectedFile,
  };

  if (currentState === RepositoryChatState.DISCONNECTED) {
    return <DisconnectedState onConnect={handleConnect} />;
  }

  return (
    <RepositoryChatLayout {...sidebarProps}>
      {currentState === RepositoryChatState.NO_REPOSITORY && (
        <RepositorySelectionState
          gh={gh}
          selectedRepoFullName={selectedRepoFullName}
          selectedBranch={selectedBranch}
          onRepoSelect={handleRepoSelect}
          onBranchSelect={handleBranchSelect}
          onIndex={handleIndex}
        />
      )}

      {currentState === RepositoryChatState.INDEXING && (
        <RepositoryIndexingState repoFullName={selectedRepoFullName} onCancel={handleCancel} />
      )}

      {currentState === RepositoryChatState.ERROR && (
        <RepositoryErrorState
          error={chat.error || 'An unknown error occurred'}
          repoFullName={selectedRepoFullName}
          onRetry={handleRetry}
          onChooseAnother={handleChooseAnother}
        />
      )}

      {currentState === RepositoryChatState.READY && (
        <RepositoryReadyState
          repoFullName={selectedRepoFullName}
          isChatting={chat.isChatting}
          onSend={handleSend}
        />
      )}

      {currentState === RepositoryChatState.CHATTING && (
        <ConversationState
          messages={chat.messages}
          isChatting={chat.isChatting}
          onSend={handleSend}
          onClear={chat.clearMessages}
          onFileClick={handleFileClick}
        />
      )}
    </RepositoryChatLayout>
  );
}
