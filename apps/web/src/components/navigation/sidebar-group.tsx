import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';
import { SidebarItem } from './sidebar-item';
import { useSidebar } from './sidebar-provider';

interface SidebarGroupItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number;
  disabled?: boolean;
}

interface SidebarGroupProps {
  label: string;
  items: SidebarGroupItem[];
  defaultOpen?: boolean;
  collapsible?: boolean;
}

export function SidebarGroup({
  label,
  items,
  defaultOpen = true,
  collapsible = false,
}: SidebarGroupProps) {
  const { collapsed, isMobile } = useSidebar();
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed && !isMobile) {
    return (
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}
      </div>
    );
  }

  if (collapsible) {
    return (
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-0.5">
          <Collapsible.Trigger className="group flex w-full items-center rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
            <span className="flex-1 text-left">{label}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
          </Collapsible.Trigger>
          <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="flex flex-col gap-0.5 pb-1">
              {items.map((item) => (
                <SidebarItem key={item.href} {...item} />
              ))}
            </div>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {items.map((item) => (
        <SidebarItem key={item.href} {...item} />
      ))}
    </div>
  );
}
