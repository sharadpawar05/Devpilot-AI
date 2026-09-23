import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getUIPreferences,
  setUIPreferences,
  getPanelLayout,
  setPanelLayout,
  getMobilePanel,
  setMobilePanel,
  subscribeUIPreferences,
  resetUIPreferences,
  reloadUIPreferences,
} from '@/lib/ui-preferences';

describe('ui-preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUIPreferences();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetUIPreferences();
  });

  it('returns defaults when storage is empty', () => {
    const prefs = getUIPreferences();
    expect(prefs.sidebarCollapsed).toBeUndefined();
    expect(prefs.panelLayouts).toEqual({});
    expect(prefs.mobilePanels).toEqual({});
  });

  it('persists sidebarCollapsed to localStorage', () => {
    setUIPreferences({ sidebarCollapsed: true });
    expect(getUIPreferences().sidebarCollapsed).toBe(true);

    const raw = JSON.parse(localStorage.getItem('devpilot_ui_preferences') || '{}');
    expect(raw.sidebarCollapsed).toBe(true);
    expect(localStorage.getItem('devpilot_sidebar_collapsed')).toBe('true');
  });

  it('migrates legacy sidebar key on first load', () => {
    localStorage.setItem('devpilot_sidebar_collapsed', 'true');
    reloadUIPreferences();
    expect(getUIPreferences().sidebarCollapsed).toBe(true);
  });

  it('stores panel layouts by storage key', () => {
    setPanelLayout('workspace-layout-test', { left: 35, right: 65 });
    expect(getPanelLayout('workspace-layout-test')).toEqual({ left: 35, right: 65 });
    expect(getUIPreferences().panelLayouts['workspace-layout-test']).toEqual({
      left: 35,
      right: 65,
    });
  });

  it('migrates legacy panel layout keys', () => {
    localStorage.setItem('legacy-split', JSON.stringify({ a: 40, b: 60 }));
    expect(getPanelLayout('legacy-split')).toEqual({ a: 40, b: 60 });
    expect(getUIPreferences().panelLayouts['legacy-split']).toEqual({ a: 40, b: 60 });
  });

  it('stores mobile active panel per page', () => {
    setMobilePanel('split-view', 'chat');
    expect(getMobilePanel('split-view')).toBe('chat');
    expect(getMobilePanel('other-page')).toBeUndefined();
  });

  it('notifies subscribers on preference updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUIPreferences(listener);
    setUIPreferences({ sidebarCollapsed: true });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setUIPreferences({ sidebarCollapsed: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('handles corrupt stored JSON without throwing', () => {
    localStorage.setItem('devpilot_ui_preferences', '{not-json');
    reloadUIPreferences();
    expect(getUIPreferences().panelLayouts).toEqual({});
  });
});
