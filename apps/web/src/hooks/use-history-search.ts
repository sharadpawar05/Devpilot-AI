import { useState, useEffect, useRef } from 'react';
import type { AIHistorySessionMetadata } from '@devpilot/types';
import { aiHistoryStorage } from '@/lib/ai-history';

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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AIHistorySessionMetadata[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debouncedQuery = useDebounce(query, debounceMs);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
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
        const matches = await aiHistoryStorage.searchSessions(debouncedQuery, 50);
        if (!controller.signal.aborted) {
          setResults(matches);
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
  }, [debouncedQuery]);

  useEffect(() => {
    const loadSuggestions = async () => {
      const repos = await aiHistoryStorage.getUniqueRepositories();
      setSuggestions(repos);
    };
    loadSuggestions();
  }, []);

  return {
    query,
    setQuery,
    results,
    isSearching,
    suggestions,
  };
}

export function useSessionSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AIHistorySessionMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const matches = await aiHistoryStorage.searchSessions(debouncedQuery, 20);
        setResults(matches);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  return { query, setQuery, results, isLoading };
}
