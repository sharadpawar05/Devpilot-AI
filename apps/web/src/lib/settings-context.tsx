import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'devpilot_settings';

export type ThemePreference = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'default' | 'large';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink';
export type DefaultReviewType = 'quick' | 'standard' | 'deep';
export type DefaultReviewDepth = 'shallow' | 'moderate' | 'thorough';
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';
export type AIModel = string;

export interface SettingsState {
  profile: {
    name: string;
    email: string;
    timezone: string;
    avatarUrl: string | null;
  };
  ai: {
    defaultProvider: AIProvider;
    defaultModel: AIModel;
    temperature: number;
    maxTokens: number;
    streamResponses: boolean;
    markdownOutput: boolean;
    autoScroll: boolean;
    autoCopy: boolean;
    defaultReviewType: DefaultReviewType;
    defaultReviewDepth: DefaultReviewDepth;
  };
  github: {
    defaultRepository: string;
    defaultBranch: string;
  };
  appearance: {
    theme: ThemePreference;
    compactMode: boolean;
    fontSize: FontSize;
    accentColor: AccentColor;
  };
  notifications: {
    reviewComplete: boolean;
    prAnalysis: boolean;
    repositorySync: boolean;
    githubAlerts: boolean;
    weeklySummary: boolean;
  };
}

const defaultSettings: SettingsState = {
  profile: {
    name: '',
    email: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    avatarUrl: null,
  },
  ai: {
    defaultProvider: 'gemini',
    defaultModel: 'gemini-3.6-flash',
    temperature: 0.7,
    maxTokens: 4096,
    streamResponses: true,
    markdownOutput: true,
    autoScroll: true,
    autoCopy: false,
    defaultReviewType: 'standard',
    defaultReviewDepth: 'moderate',
  },
  github: {
    defaultRepository: '',
    defaultBranch: 'main',
  },
  appearance: {
    theme: 'system',
    compactMode: false,
    fontSize: 'default',
    accentColor: 'blue',
  },
  notifications: {
    reviewComplete: true,
    prAnalysis: true,
    repositorySync: false,
    githubAlerts: true,
    weeklySummary: false,
  },
};

interface SettingsContextType {
  settings: SettingsState;
  updateProfile: (updates: Partial<SettingsState['profile']>) => void;
  updateAI: (updates: Partial<SettingsState['ai']>) => void;
  updateGitHub: (updates: Partial<SettingsState['github']>) => void;
  updateAppearance: (updates: Partial<SettingsState['appearance']>) => void;
  updateNotifications: (updates: Partial<SettingsState['notifications']>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

function loadSettings(): SettingsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultSettings,
        ...parsed,
        profile: { ...defaultSettings.profile, ...parsed.profile },
        ai: { ...defaultSettings.ai, ...parsed.ai },
        github: { ...defaultSettings.github, ...parsed.github },
        appearance: { ...defaultSettings.appearance, ...parsed.appearance },
        notifications: { ...defaultSettings.notifications, ...parsed.notifications },
      };
    }
  } catch {
    // ignore
  }
  return defaultSettings;
}

function saveSettings(settings: SettingsState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateProfile = useCallback((updates: Partial<SettingsState['profile']>) => {
    setSettings((prev) => ({ ...prev, profile: { ...prev.profile, ...updates } }));
  }, []);

  const updateAI = useCallback((updates: Partial<SettingsState['ai']>) => {
    setSettings((prev) => ({ ...prev, ai: { ...prev.ai, ...updates } }));
  }, []);

  const updateGitHub = useCallback((updates: Partial<SettingsState['github']>) => {
    setSettings((prev) => ({ ...prev, github: { ...prev.github, ...updates } }));
  }, []);

  const updateAppearance = useCallback((updates: Partial<SettingsState['appearance']>) => {
    setSettings((prev) => ({ ...prev, appearance: { ...prev.appearance, ...updates } }));
  }, []);

  const updateNotifications = useCallback((updates: Partial<SettingsState['notifications']>) => {
    setSettings((prev) => ({ ...prev, notifications: { ...prev.notifications, ...updates } }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateProfile,
        updateAI,
        updateGitHub,
        updateAppearance,
        updateNotifications,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export function useSettingsState(): SettingsState {
  const context = useContext(SettingsContext);
  if (context) return context.settings;
  return loadSettings();
}
