import { vi } from 'vitest';

export const useAuth = vi.fn(() => ({
  session: {
    accessToken: 'mock-token',
  },
}));
