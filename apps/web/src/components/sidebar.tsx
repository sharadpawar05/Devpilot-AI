import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Users, Sparkles, Code } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface SidebarGroup {
  label: string;
  links: SidebarLink[];
}

const groups: SidebarGroup[] = [
  {
    label: 'Overview',
    links: [{ label: 'Overview', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'AI Tools',
    links: [
      { label: 'Playground', href: '/playground', icon: Sparkles },
      { label: 'Code Review', href: '/code-review', icon: Code },
    ],
  },
  {
    label: 'Manage',
    links: [
      { label: 'Teams', href: '/dashboard/teams', icon: Users },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-56 shrink-0 border-r bg-muted/40 md:block">
      <nav className="flex flex-col gap-4 p-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.links.map((link) => {
                const isActive = location.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
