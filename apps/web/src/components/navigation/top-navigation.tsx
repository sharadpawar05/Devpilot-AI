import { Search, Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { useCommandPalette } from '@/components/command-palette';
import { useSidebar } from './sidebar-provider';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';

export function TopNavigation() {
  const { theme, setTheme } = useTheme();
  const { isMobile, setMobileOpen } = useSidebar();
  const { open } = useCommandPalette();

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6"
      role="banner"
    >
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          aria-controls="app-sidebar"
          aria-expanded={false}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
      )}

      <div className="flex-1">
        <button
          onClick={open}
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground hover:shadow-sm active:scale-[0.99]"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline-block">Search repositories, prompts, reviews...</span>
          <kbd className="pointer-events-none ml-auto hidden select-none rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            /
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />

        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <Sun
            className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            aria-hidden
          />
          <Moon
            className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            aria-hidden
          />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
}
