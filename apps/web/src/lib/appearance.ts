import type { SettingsData } from '@/hooks/use-settings';

export type Appearance = SettingsData['appearance'];

/**
 * Applies the persisted appearance preferences (everything except theme, which
 * flows through ThemeProvider) to the document root. The matching CSS lives in
 * styles/globals.css ([data-font-size], [data-compact], [data-accent]).
 */
export function applyAppearance(appearance: Appearance): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-font-size', appearance.fontSize);
  root.setAttribute('data-accent', appearance.accentColor);
  if (appearance.compactMode) {
    root.setAttribute('data-compact', 'true');
  } else {
    root.removeAttribute('data-compact');
  }
}

export function clearAppearance(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.removeAttribute('data-font-size');
  root.removeAttribute('data-compact');
  root.removeAttribute('data-accent');
}
