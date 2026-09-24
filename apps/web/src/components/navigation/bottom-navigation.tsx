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
        'bottom-nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90',
        'pb-[env(safe-area-inset-bottom)]',
        isMobile ? 'block' : 'hidden md:hidden',
      )}
    >
      <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-around">
        {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => (
          <li key={href} className="flex-1">
            <NavLink
              to={href}
              className={({ isActive }) =>
                cn(
                  'nav-item h-full min-h-[56px] flex-col gap-1 rounded-none px-1 text-[11px] font-medium active:scale-95',
                  isActive ? 'nav-item-active' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              <span className="nav-icon" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="nav-label">{label}</span>
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-controls="app-sidebar"
            className="nav-item h-full min-h-[56px] w-full flex-col gap-1 rounded-none px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <span className="nav-icon" aria-hidden>
              <Menu className="h-5 w-5" />
            </span>
            <span className="nav-label">Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
