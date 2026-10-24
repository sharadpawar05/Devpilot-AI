const STORAGE_KEY = 'devpilot_settings';

export type ThemePreference = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'default' | 'large';
export type AccentColor = 'blue' | 'purple' | 'green' | 'orange' | 'pink';
export type DefaultReviewType = 'quick' | 'standard' | 'deep';
export type DefaultReviewDepth = 'shallow' | 'moderate' | 'thorough';
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq';
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

/**
 * Local settings snapshot for consumers outside the settings page (chat
 * input, analytics, repository chat). The settings page itself reads and
 * writes the server-backed layer in hooks/use-settings.ts; this remains only
 * as a read fallback for UI defaults that are injected server-side anyway.
 */
export function useSettingsState(): SettingsState {
  return loadSettings();
}
