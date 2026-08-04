import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, FileCode, GitPullRequest, MessageSquare, Play, ArrowRight } from 'lucide-react';

interface HistoryEmptyStateProps {
  hasFilters: boolean;
}

export const HistoryEmptyState = memo(function HistoryEmptyState({
  hasFilters,
}: HistoryEmptyStateProps) {
  const navigate = useNavigate();

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <History className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold">No matching sessions</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <History className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">No history yet</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Start using AI features to build your history. Your conversations and reviews will appear
        here.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickStart
          icon={FileCode}
          label="Code Review"
          onClick={() => navigate('/code-review')}
          color="text-purple-500"
        />
        <QuickStart
          icon={GitPullRequest}
          label="PR Assistant"
          onClick={() => navigate('/pull-request-assistant')}
          color="text-blue-500"
        />
        <QuickStart
          icon={MessageSquare}
          label="Repository Chat"
          onClick={() => navigate('/repository-chat')}
          color="text-emerald-500"
        />
        <QuickStart
          icon={Play}
          label="Playground"
          onClick={() => navigate('/playground')}
          color="text-pink-500"
        />
      </div>
    </div>
  );
});

function QuickStart({
  icon: Icon,
  label,
  onClick,
  color,
}: {
  icon: typeof FileCode;
  label: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-medium transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <Icon className={`h-4 w-4 ${color}`} />
      {label}
      <ArrowRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-all ml-auto" />
    </button>
  );
}
