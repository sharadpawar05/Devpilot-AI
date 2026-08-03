import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/auth';
import type { AIHistorySessionMetadata } from '@devpilot/types';
import { aiHistoryApi } from '@/lib/ai-history';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

interface UseHistorySearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: AIHistorySessionMetadata[];
  isSearching: boolean;
  suggestions: string[];
}

export function useHistorySearch(debounceMs: number = 300): UseHistorySearchReturn {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AIHistorySessionMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, debounceMs);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debouncedQuery.trim() || !token) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const search = async () => {
      setIsSearching(true);
      try {
        const result = await aiHistoryApi.listSessions(
          token,
          { search: debouncedQuery },
          { page: 1, pageSize: 50 },
        );
        if (!controller.signal.aborted) {
          setResults(result.sessions);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    search();

    return () => controller.abort();
  }, [debouncedQuery, token]);

  useEffect(() => {
    if (!token) return;
    const loadSuggestions = async () => {
      const repos = await aiHistoryApi.getUniqueRepositories(token);
      setSuggestions(repos);
    };
    loadSuggestions();
  }, [token]);

  return {
    query,
    setQuery,
    results,
    isSearching,
    suggestions,
  };
}

export function useSessionSearch() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AIHistorySessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (!debouncedQuery.trim() || !token) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const result = await aiHistoryApi.listSessions(
          token,
          { search: debouncedQuery },
          { page: 1, pageSize: 20 },
        );
        setResults(result.sessions);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery, token]);

  return { query, setQuery, results, isLoading };
}
