import { useTheme } from '@/lib/theme';
import { useSettingsQuery, useUpdateAppearance } from '@/hooks/use-settings';

/**
 * Theme toggle that persists the choice to the saved appearance settings
 * (the server is the source of truth), falling back to a local-only change
 * while settings are unavailable (logged out / still loading). Rolls the
 * optimistic change back if the persist fails.
 */
export function useThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { data } = useSettingsQuery();
  const updateAppearance = useUpdateAppearance();

  const toggle = () => {
    const next: 'light' | 'dark' = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next); // instant feedback
    if (!data?.appearance) return;
    const persisted = data.appearance;
    updateAppearance.mutate(
      { ...persisted, theme: next },
      {
        onError: () => setTheme(persisted.theme), // revert to the saved value
      },
    );
  };

  return { theme, resolvedTheme, toggle, isSaving: updateAppearance.isPending };
}
