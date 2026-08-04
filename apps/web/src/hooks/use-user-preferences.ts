import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'devpilot_user_preferences';

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultProvider: string;
  defaultModel: string;
  reviewType: string;
  reviewDepth: string;
  streamingEnabled: boolean;
  sidebarCollapsed: boolean;
  recentPrompts: string[];
  panelSizes: Record<string, number>;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  defaultProvider: 'gemini',
  defaultModel: 'gemini-flash-latest',
  reviewType: 'Standard',
  reviewDepth: 'Standard',
  streamingEnabled: true,
  sidebarCollapsed: false,
  recentPrompts: [],
  panelSizes: {},
};

function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {
    /* noop */
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* noop */
  }
}

function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const addRecentPrompt = useCallback((prompt: string) => {
    setPreferences((prev) => {
      const trimmed = prompt.trim();
      if (!trimmed) return prev;
      const filtered = prev.recentPrompts.filter((p) => p !== trimmed);
      return {
        ...prev,
        recentPrompts: [trimmed, ...filtered].slice(0, 10),
      };
    });
  }, []);

  const removeRecentPrompt = useCallback((prompt: string) => {
    setPreferences((prev) => ({
      ...prev,
      recentPrompts: prev.recentPrompts.filter((p) => p !== prompt),
    }));
  }, []);

  const clearRecentPrompts = useCallback(() => {
    setPreferences((prev) => ({ ...prev, recentPrompts: [] }));
  }, []);

  const updatePanelSize = useCallback((key: string, size: number) => {
    setPreferences((prev) => ({
      ...prev,
      panelSizes: { ...prev.panelSizes, [key]: size },
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    updatePreference,
    addRecentPrompt,
    removeRecentPrompt,
    clearRecentPrompts,
    updatePanelSize,
    resetPreferences,
  };
}

export { useUserPreferences };
export type { UserPreferences };
