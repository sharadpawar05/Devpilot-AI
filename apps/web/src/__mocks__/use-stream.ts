import { vi } from 'vitest';

export const useStreamSession = vi.fn(() => ({
  content: '',
  isStreaming: false,
  error: null,
  metadata: null,
  startStream: vi.fn(),
  stopStream: vi.fn(),
  reset: vi.fn(),
}));
