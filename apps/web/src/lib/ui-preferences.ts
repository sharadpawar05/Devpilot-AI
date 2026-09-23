import { useSyncExternalStore } from 'react';

export interface UIPreferences {
  /** unset = adaptive default (tablet collapses, desktop expands) */
  sidebarCollapsed?: boolean;
  panelLayouts: Record<string, Record<string, number>>;
  mobilePanels: Record<string, string>;
}

const STORAGE_KEY = 'devpilot_ui_preferences';
const LEGACY_SIDEBAR_KEY = 'devpilot_sidebar_collapsed';

function defaults(): UIPreferences {
  return { panelLayouts: {}, mobilePanels: {} };
}

let cache: UIPreferences | null = null;
const listeners = new Set<() => void>();

function load(): UIPreferences {
  const prefs = defaults();
  try {
    const legacySidebar = localStorage.getItem(LEGACY_SIDEBAR_KEY);
    if (legacySidebar !== null) {
      prefs.sidebarCollapsed = legacySidebar === 'true';
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UIPreferences>;
      if (typeof parsed.sidebarCollapsed === 'boolean') {
        prefs.sidebarCollapsed = parsed.sidebarCollapsed;
      }
      if (parsed.panelLayouts && typeof parsed.panelLayouts === 'object') {
        prefs.panelLayouts = parsed.panelLayouts;
      }
      if (parsed.mobilePanels && typeof parsed.mobilePanels === 'object') {
        prefs.mobilePanels = parsed.mobilePanels;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return prefs;
}

function persist(prefs: UIPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    if (typeof prefs.sidebarCollapsed === 'boolean') {
      localStorage.setItem(LEGACY_SIDEBAR_KEY, String(prefs.sidebarCollapsed));
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getUIPreferences(): UIPreferences {
  if (cache === null) {
    cache = load();
  }
  return cache;
}

export function setUIPreferences(patch: Partial<UIPreferences>): void {
  const next: UIPreferences = { ...getUIPreferences(), ...patch };
  cache = next;
  persist(next);
  emit();
}

export function subscribeUIPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPanelLayout(storageKey: string): Record<string, number> | undefined {
  const central = getUIPreferences().panelLayouts[storageKey];
  if (central) return central;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      setUIPreferences({
        panelLayouts: { ...getUIPreferences().panelLayouts, [storageKey]: parsed },
      });
      return parsed;
    }
  } catch {
    /* ignore corrupt legacy layout */
  }
  return undefined;
}

export function setPanelLayout(storageKey: string, layout: Record<string, number>): void {
  setUIPreferences({
    panelLayouts: { ...getUIPreferences().panelLayouts, [storageKey]: layout },
  });
}

export function getMobilePanel(pageKey: string): string | undefined {
  return getUIPreferences().mobilePanels[pageKey];
}

export function setMobilePanel(pageKey: string, panelId: string): void {
  setUIPreferences({
    mobilePanels: { ...getUIPreferences().mobilePanels, [pageKey]: panelId },
  });
}

export function useUIPreferences(): UIPreferences {
  return useSyncExternalStore(subscribeUIPreferences, getUIPreferences, getUIPreferences);
}

export function reloadUIPreferences(): void {
  cache = null;
  emit();
}

export function resetUIPreferences(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_SIDEBAR_KEY);
  } catch {
    /* noop */
  }
  cache = null;
  emit();
}
