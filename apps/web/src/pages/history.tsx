import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import type {
  AIHistorySessionMetadata,
  AIHistorySession,
  AIHistoryFilters,
  WorkflowType,
} from '@devpilot/types';
import { useAuth } from '@/auth';
import { useHistory } from '@/hooks/use-history';
import { useHistorySearch } from '@/hooks/use-history-search';
import { HistoryCard } from '@/components/history/HistoryCard';
import { SearchBar } from '@/components/history/SearchBar';
import { FilterTabs, type FilterTab } from '@/components/history/FilterTabs';
import { BulkActionsBar } from '@/components/history/BulkActionsBar';
import { HistoryEmptyState } from '@/components/history/HistoryEmptyState';
import { HistoryPageSkeleton } from '@/components/history/HistorySkeletons';
import { TimeGroupHeader } from '@/components/history/TimeGroupHeader';
import { ConversationView } from '@/components/history/ConversationView';
import { groupSessionsByTime } from '@/lib/history-utils';
import { aiHistoryApi } from '@/lib/ai-history';
import { useToast } from '@/components/ui/toast';

const TAB_TO_WORKFLOW: Record<FilterTab, WorkflowType[] | undefined> = {
  all: undefined,
  'code-review': ['code-review'],
  'pr-assistant': ['pr-review', 'pr-analysis'],
  'repository-chat': ['repository-chat'],
  playground: [
    'playground',
    'documentation',
    'test-generation',
    'security-review',
    'architecture-review',
  ],
  'github-review': ['pr-review', 'pr-analysis'],
};

export function HistoryPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.accessToken;

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AIHistorySession | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters: AIHistoryFilters = useMemo(() => {
    const workflowTypes = TAB_TO_WORKFLOW[activeTab];
    return workflowTypes ? { workflowType: workflowTypes } : {};
  }, [activeTab]);

  const {
    sessions,
    pagination,
    isLoading,
    deletingIds,
    loadMore,
    deleteSession,
    toggleFavorite,
    updateSession,
    getSession,
    refresh,
  } = useHistory(filters);

  const { toast } = useToast();

  const { query, setQuery, results: searchResults, isSearching } = useHistorySearch();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Infinite scrolling
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [pagination?.hasMore, isLoading, loadMore]);

  const displaySessions = query.trim() ? searchResults : sessions;

  const groupedSessions = useMemo(() => groupSessionsByTime(displaySessions), [displaySessions]);

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<FilterTab, number>> = { all: sessions.length };
    for (const tab of Object.keys(TAB_TO_WORKFLOW) as FilterTab[]) {
      if (tab === 'all') continue;
      const types = TAB_TO_WORKFLOW[tab];
      if (types) {
        counts[tab] = sessions.filter((s) => types.includes(s.workflowType)).length;
      }
    }
    return counts;
  }, [sessions]);

  const handleSelectSession = useCallback(
    async (sessionMeta: AIHistorySessionMetadata) => {
      const fullSession = await getSession(sessionMeta.id);
      if (fullSession) {
        setSelectedSession(fullSession);
        setSelectedSessionId(sessionMeta.id);
      }
    },
    [getSession],
  );

  const handleContinueSession = useCallback(
    (sessionMeta: AIHistorySessionMetadata) => {
      const routes: Record<string, string> = {
        playground: '/playground',
        'code-review': '/code-review',
        'pr-review': '/pull-request-assistant',
        'pr-analysis': '/pull-request-assistant',
        'repository-chat': '/repository-chat',
        documentation: '/playground',
        'test-generation': '/playground',
        'security-review': '/playground',
        'architecture-review': '/playground',
      };
      const baseRoute = routes[sessionMeta.workflowType] || '/playground';
      navigate(`${baseRoute}?continue=${sessionMeta.id}`);
    },
    [navigate],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      const result = await deleteSession(id);
      if (selectedSessionId === id) {
        setSelectedSession(null);
        setSelectedSessionId(null);
      }
      if (result) {
        toast({
          title: 'Conversation deleted',
          description: 'The conversation has been permanently removed.',
        });
      } else {
        toast({
          title: 'Delete failed',
          description: 'Failed to delete the conversation. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [deleteSession, selectedSessionId, toast],
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    let deletedCount = 0;
    for (const id of selectedIds) {
      const result = await deleteSession(id);
      if (result) {
        deletedCount++;
      }
    }
    setSelectedIds(new Set());
    if (deletedCount > 0) {
      toast({
        title: 'Conversations deleted',
        description: `${deletedCount} conversation${deletedCount > 1 ? 's' : ''} have been permanently removed.`,
      });
    } else {
      toast({
        title: 'Delete failed',
        description: 'Failed to delete conversations. Please try again.',
        variant: 'destructive',
      });
    }
  }, [selectedIds, deleteSession, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.size > 0) {
        handleBulkDelete();
      }
      if (e.key === 'Enter' && selectedIds.size === 1) {
        const id = Array.from(selectedIds)[0];
        const s = displaySessions.find((sess) => sess.id === id);
        if (s) handleSelectSession(s);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, handleBulkDelete, handleSelectSession, displaySessions]);

  const handleBulkFavorite = useCallback(async () => {
    for (const id of selectedIds) {
      const s = sessions.find((sess) => sess.id === id);
      if (s) {
        await updateSession(id, { favorite: !s.favorite });
      }
    }
    setSelectedIds(new Set());
  }, [selectedIds, sessions, updateSession]);

  const handleDuplicate = useCallback(
    async (sessionMeta: AIHistorySessionMetadata) => {
      if (!token) return;
      const fullSession = await getSession(sessionMeta.id);
      if (!fullSession) return;
      await aiHistoryApi.createSession(token, {
        workflowType: fullSession.workflowType,
        repository: fullSession.repository,
        title: `${fullSession.title} (Copy)`,
        provider: fullSession.provider,
        model: fullSession.model,
        messages: fullSession.messages,
      });
      await refresh();
    },
    [token, getSession, refresh],
  );

  const hasFilters = query.trim().length > 0 || activeTab !== 'all';

  if (selectedSession) {
    return (
      <div className="h-full">
        <ConversationView
          session={selectedSession}
          onBack={() => {
            setSelectedSession(null);
            setSelectedSessionId(null);
          }}
          onContinue={(session) => {
            const routes: Record<string, string> = {
              playground: '/playground',
              'code-review': '/code-review',
              'pr-review': '/pull-request-assistant',
              'pr-analysis': '/pull-request-assistant',
              'repository-chat': '/repository-chat',
              documentation: '/playground',
              'test-generation': '/playground',
              'security-review': '/playground',
              'architecture-review': '/playground',
            };
            const baseRoute = routes[session.workflowType] || '/playground';
            navigate(`${baseRoute}?continue=${session.id}`);
          }}
        />
      </div>
    );
  }

  if (isLoading && sessions.length === 0) {
    return <HistoryPageSkeleton />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-input px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">History</h1>
            {pagination && (
              <span className="text-sm text-muted-foreground">
                {pagination.total} conversations
              </span>
            )}
          </div>
          <SearchBar value={query} onChange={setQuery} className="w-full sm:w-80" />
        </div>

        <div className="mt-4">
          <FilterTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-4">
            <BulkActionsBar
              count={selectedIds.size}
              onClearSelection={() => setSelectedIds(new Set())}
              onFavoriteSelected={handleBulkFavorite}
              onDeleteSelected={handleBulkDelete}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isSearching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displaySessions.length === 0 ? (
          <HistoryEmptyState hasFilters={hasFilters} />
        ) : (
          <div className="space-y-4">
            {groupedSessions.map((group, groupIdx) => (
              <div key={group.key}>
                <TimeGroupHeader
                  label={group.label}
                  count={group.sessions.length}
                  isFirst={groupIdx === 0}
                />
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {group.sessions.map((session) => (
                    <HistoryCard
                      key={session.id}
                      session={session as AIHistorySessionMetadata}
                      onSelect={handleSelectSession}
                      onContinue={handleContinueSession}
                      onToggleFavorite={toggleFavorite}
                      onDelete={handleDeleteSession}
                      onDuplicate={handleDuplicate}
                      selected={selectedIds.has(session.id)}
                      onToggleSelect={handleToggleSelect}
                      isDeleting={deletingIds.has(session.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div ref={loadMoreRef} className="h-4" />
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {pagination && !pagination.hasMore && displaySessions.length > 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No more sessions to load
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
