import { Link } from 'react-router-dom';
import { Moon, Sun, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/auth';

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="hidden font-bold sm:inline-block">Engineering AI</span>
        </Link>

        <nav className="flex flex-1 items-center gap-6 text-sm">
          <Link to="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
            Home
          </Link>
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {user?.avatarUrl && (
                <img src={user.avatarUrl} alt={user.name} className="h-7 w-7 rounded-full" />
              )}
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="mr-1 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
