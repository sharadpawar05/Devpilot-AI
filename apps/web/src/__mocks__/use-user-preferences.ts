import { vi } from 'vitest';

export const useUserPreferences = vi.fn(() => ({
  preferences: {
    defaultProvider: 'gemini',
    defaultModel: 'gemini-3.6-flash',
  },
  updatePreference: vi.fn(),
  addRecentPrompt: vi.fn(),
}));
