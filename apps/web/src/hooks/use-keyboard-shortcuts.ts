import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutConfig[];
  enabled?: boolean;
}

function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcutsRef.current) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          break;
        }
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

interface UseStreamingAbortOptions {
  onAbort?: () => void;
  enabled?: boolean;
}

function useStreamingAbort({ onAbort, enabled = true }: UseStreamingAbortOptions) {
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'Escape',
        handler: () => onAbort?.(),
        description: 'Cancel streaming',
      },
    ],
    enabled,
  });
}

interface UseCopyResponseOptions {
  getContent: () => string | undefined;
  enabled?: boolean;
}

function useCopyResponse({ getContent, enabled = true }: UseCopyResponseOptions) {
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'c',
        ctrl: true,
        shift: true,
        handler: async () => {
          const content = getContent();
          if (content) {
            await navigator.clipboard.writeText(content);
          }
        },
        description: 'Copy response',
      },
    ],
    enabled,
  });
}

interface UseGlobalSearchOptions {
  onOpen?: () => void;
  enabled?: boolean;
}

function useGlobalSearch({ onOpen, enabled = true }: UseGlobalSearchOptions) {
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'k',
        ctrl: true,
        handler: () => onOpen?.(),
        description: 'Global search',
      },
    ],
    enabled,
  });
}

export { useKeyboardShortcuts, useStreamingAbort, useCopyResponse, useGlobalSearch };
export type { ShortcutConfig, UseKeyboardShortcutsOptions };
