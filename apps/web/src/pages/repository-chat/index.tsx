import { useState, useCallback } from 'react';
import { useAuth } from '@/auth';
import { useGitHub } from '@/hooks/use-github';
import { useRepositoryChat } from '@/hooks/use-repository-chat';
import { RepositorySidebar } from '@/components/repository-chat/RepositorySidebar';
import { ChatWindow } from '@/components/repository-chat/ChatWindow';

export function RepositoryChatPage() {
  const { session } = useAuth();
  const gh = useGitHub();
  const {
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
  } = useRepositoryChat(session?.accessToken);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  const isIndexed = tree.length > 0;

  const repoParts = selectedRepoFullName.split('/');
  const owner = repoParts[0] || '';
  const repo = repoParts[1] || '';

  const handleRepoSelect = useCallback((fullName: string) => {
    setSelectedRepoFullName(fullName);
    setSelectedBranch('main');
  }, []);

  const handleBranchSelect = useCallback((branch: string) => {
    setSelectedBranch(branch);
  }, []);

  const handleIndex = useCallback(
    (o: string, r: string, branch: string) => {
      indexRepository(o, r, branch);
    },
    [indexRepository],
  );

  const handleSend = useCallback(
    (question: string, provider: string, model?: string) => {
      if (owner && repo) {
        sendMessage(owner, repo, selectedBranch, question, provider, model);
      }
    },
    [owner, repo, selectedBranch, sendMessage],
  );

  const handleFileClick = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  return (
    <div className="flex h-full">
      <RepositorySidebar
        gh={gh}
        tree={tree}
        indexedFiles={indexedFiles}
        indexedAt={indexedAt}
        isIndexing={isIndexing}
        selectedRepoFullName={selectedRepoFullName}
        selectedBranch={selectedBranch}
        onRepoSelect={handleRepoSelect}
        onBranchSelect={handleBranchSelect}
        onIndex={handleIndex}
        onFileSelect={handleFileClick}
        selectedFile={selectedFile}
      />

      <div className="flex flex-1 flex-col">
        {error && (
          <div className="border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <ChatWindow
          messages={messages}
          isChatting={isChatting}
          isIndexed={isIndexed}
          onSend={handleSend}
          onClear={clearMessages}
          onFileClick={handleFileClick}
        />
      </div>
    </div>
  );
}
