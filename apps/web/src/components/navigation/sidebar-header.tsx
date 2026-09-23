import { Link } from 'react-router-dom';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-provider';

export function SidebarHeader() {
  const { collapsed, toggleCollapsed, isMobile } = useSidebar();

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b px-4',
        collapsed && !isMobile ? 'justify-center px-2' : 'gap-3',
      )}
    >
      <Link
        to="/dashboard"
        className="group flex items-center gap-2.5 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="DevPilot home"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
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
            'ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:scale-105 hover:bg-accent hover:text-accent-foreground active:scale-95',
            collapsed && 'ml-0',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
