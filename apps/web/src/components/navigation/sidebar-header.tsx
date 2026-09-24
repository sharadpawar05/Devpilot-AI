import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-provider';

export function SidebarHeader() {
  const { collapsed, toggleCollapsed, isMobile } = useSidebar();

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center border-b px-4',
        collapsed && !isMobile ? 'justify-center px-2' : 'gap-3 justify-start',
      )}
    >
      <Link
        to="/dashboard"
        className="group flex items-center gap-2.5 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="DevPilot home"
      >
        <span className="nav-icon" aria-hidden>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
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
        </span>
        {(!collapsed || isMobile) && (
          <span className="nav-label text-lg font-bold tracking-tight">DevPilot</span>
        )}
      </Link>
      {!isMobile && (
        <button
          onClick={toggleCollapsed}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-[#f3f4f6] hover:text-foreground active:scale-95',
            collapsed ? 'mx-auto' : 'ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (Ctrl+B)`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
