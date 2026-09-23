import { Menu, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { SearchBar } from '@/components/search';
import { useSidebar } from './sidebar-provider';
import { UserMenu } from './user-menu';
import { NotificationBell } from './notification-bell';

export function TopNavigation() {
  const { theme, setTheme } = useTheme();
  const { isMobile, setMobileOpen } = useSidebar();

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

      <SearchBar />

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
