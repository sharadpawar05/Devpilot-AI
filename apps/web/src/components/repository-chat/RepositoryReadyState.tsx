import { MessageSquare } from 'lucide-react';
import { SuggestedQuestions } from './SuggestedQuestions';
import { ChatInput } from './ChatInput';

interface RepositoryReadyStateProps {
  repoFullName: string;
  isChatting: boolean;
  onSend: (question: string, provider: string, model: string) => void;
}

export function RepositoryReadyState({
  repoFullName,
  isChatting,
  onSend,
}: RepositoryReadyStateProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4">
        <div className="mx-auto w-full max-w-lg text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-bold tracking-tight">Repository Ready</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask anything about <span className="font-medium text-foreground">{repoFullName}</span>
          </p>

          <div className="mt-8">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Suggested Questions</p>
            <SuggestedQuestions
              onSelect={(q) => onSend(q, 'gemini', 'gemini-3.5-flash')}
              disabled={isChatting}
            />
          </div>
        </div>
      </div>

      <ChatInput onSend={onSend} disabled={isChatting} placeholder="Ask about this repository..." />
    </div>
  );
}
