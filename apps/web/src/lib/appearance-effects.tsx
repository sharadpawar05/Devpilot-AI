import { useEffect } from 'react';
import { useSettingsQuery } from '@/hooks/use-settings';
import { useTheme } from '@/lib/theme';
import { applyAppearance } from '@/lib/appearance';

/**
 * Hydrates appearance (theme, font size, compact mode, accent color) from the
 * server once settings load, keeping the document root in sync with the saved
 * preferences instead of localStorage-only state.
 */
export function AppearanceEffects() {
  const { data } = useSettingsQuery();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (!data?.appearance) return;
    setTheme(data.appearance.theme);
    applyAppearance(data.appearance);
  }, [data, setTheme]);

  return null;
}
