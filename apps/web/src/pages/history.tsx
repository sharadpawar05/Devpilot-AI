import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Loader2 } from 'lucide-react';
import type { AIHistorySessionMetadata, AIHistorySession, AIHistoryFilters } from '@devpilot/types';
import { useHistory } from '@/hooks/use-history';
import { useHistorySearch } from '@/hooks/use-history-search';
import { HistoryCard } from '@/components/history/HistoryCard';
import { SearchBar } from '@/components/history/SearchBar';
import { FilterPanel } from '@/components/history/FilterPanel';
import { ConversationView } from '@/components/history/ConversationView';
import { aiHistoryStorage } from '@/lib/ai-history';

export function HistoryPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AIHistoryFilters>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<AIHistorySession | null>(null);
  const [repositories, setRepositories] = useState<string[]>([]);
  const { query, setQuery, results: searchResults, isSearching } = useHistorySearch();
  const {
    sessions,
    pagination,
    isLoading,
    loadMore,
    deleteSession,
    togglePin,
    toggleFavorite,
    toggleArchive,
    updateSession,
    getSession,
  } = useHistory(filters);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadRepos = async () => {
      const repos = await aiHistoryStorage.getUniqueRepositories();
      setRepositories(repos);
    };
    loadRepos();
  }, [sessions]);

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
      navigate(`/playground?continue=${sessionMeta.id}`);
    },
    [navigate],
  );

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      if (selectedSessionId === id) {
        setSelectedSession(null);
        setSelectedSessionId(null);
      }
    },
    [deleteSession, selectedSessionId],
  );

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      await updateSession(id, { title });
    },
    [updateSession],
  );

  const displaySessions = query.trim() ? searchResults : sessions;

  if (selectedSession) {
    return (
      <div className="h-full">
        <ConversationView
          session={selectedSession}
          onBack={() => {
            setSelectedSession(null);
            setSelectedSessionId(null);
          }}
          onContinue={(session) => navigate(`/playground?continue=${session.id}`)}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-64 shrink-0 border-r border-input p-4">
        <FilterPanel filters={filters} onFiltersChange={setFilters} repositories={repositories} />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="border-b border-input p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <h1 className="text-lg font-semibold">AI History</h1>
              </div>
              {pagination && (
                <span className="text-sm text-muted-foreground">
                  {pagination.total} conversations
                </span>
              )}
            </div>
            <SearchBar
              value={query}
              onChange={setQuery}
              placeholder="Search by title or repository..."
              className="mt-4"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isSearching || isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displaySessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <h3 className="text-lg font-medium">No history yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your AI conversations will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displaySessions.map((session) => (
                  <HistoryCard
                    key={session.id}
                    session={session}
                    onSelect={handleSelectSession}
                    onContinue={handleContinueSession}
                    onTogglePin={togglePin}
                    onToggleFavorite={toggleFavorite}
                    onToggleArchive={toggleArchive}
                    onDelete={handleDeleteSession}
                    onRename={handleRenameSession}
                  />
                ))}
                <div ref={loadMoreRef} className="h-4" />
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {pagination && !pagination.hasMore && displaySessions.length > 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No more conversations to load
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
