import { vi } from 'vitest';

export const useChat = vi.fn(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  data: null,
}));

export const useChatHistory = vi.fn(() => ({
  getSession: vi.fn().mockResolvedValue(null),
}));
