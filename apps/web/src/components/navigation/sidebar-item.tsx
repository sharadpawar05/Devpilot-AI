import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from './sidebar-provider';

interface SidebarItemProps {
  label: string;
  href: string;
  icon: LucideIcon;
  isActive?: boolean;
  badge?: string | number;
  disabled?: boolean;
}

export function SidebarItem({ label, href, icon: Icon, badge, disabled }: SidebarItemProps) {
  const location = useLocation();
  const { collapsed, isMobile } = useSidebar();
  const isActive = location.pathname === href || location.pathname.startsWith(href + '/');

  const content = (
    <Link
      to={disabled ? '#' : href}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
        collapsed && !isMobile && 'justify-center px-2',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-accent-foreground')} />
      {(!collapsed || isMobile) && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed && !isMobile) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
