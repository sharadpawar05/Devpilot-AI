import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-provider';

export function SidebarHeader() {
  const { collapsed, toggleCollapsed, isMobile } = useSidebar();

  return (
    <div
      className={cn(
        'flex h-14 items-center border-b px-4',
        collapsed && !isMobile ? 'justify-center' : 'gap-3',
      )}
    >
      <Link to="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        {(!collapsed || isMobile) && (
          <span className="text-lg font-bold tracking-tight">DevPilot</span>
        )}
      </Link>
      {!isMobile && (
        <button
          onClick={toggleCollapsed}
          className={cn(
            'ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            collapsed && 'ml-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
