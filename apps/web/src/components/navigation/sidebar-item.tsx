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
  const isCollapsedView = collapsed && !isMobile;

  const content = (
    <Link
      to={disabled ? '#' : href}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={cn(
        'nav-item group relative px-3 py-2 text-sm font-medium active:scale-[0.98]',
        'min-h-[40px]',
        isCollapsedView ? 'justify-center px-2' : 'justify-start',
        isActive
          ? 'nav-item-active shadow-sm'
          : 'text-muted-foreground hover:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
      )}
      aria-current={isActive ? 'page' : undefined}
      title={isCollapsedView ? label : undefined}
    >
      <span className={cn('nav-icon', isCollapsedView && 'nav-item-icon')} aria-hidden>
        <Icon
          className={cn(
            'h-[18px] w-[18px] transition-colors duration-150',
            isActive && 'text-white',
          )}
        />
        {badge != null && isCollapsedView && <span className="nav-badge">{badge}</span>}
      </span>

      {!isCollapsedView && (
        <>
          <span className="nav-label flex-1 truncate">{label}</span>
          {badge != null && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (isCollapsedView) {
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
