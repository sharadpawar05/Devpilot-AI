import { NavLink } from 'react-router-dom';
import { History, LayoutDashboard, Menu, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-provider';

const BOTTOM_NAV_ITEMS = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'AI', href: '/playground', icon: Sparkles },
  { label: 'Chat', href: '/repository-chat', icon: MessageSquare },
  { label: 'History', href: '/history', icon: History },
] as const;

export function BottomNavigation() {
  const { isMobile, setMobileOpen } = useSidebar();

  return (
    <nav
      aria-label="Mobile navigation"
      data-testid="bottom-navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90',
        'pb-[env(safe-area-inset-bottom)]',
        isMobile ? 'block' : 'hidden md:hidden',
      )}
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
        {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <li key={href} className="flex-1">
            <NavLink
              to={href}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-controls="app-sidebar"
            className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
