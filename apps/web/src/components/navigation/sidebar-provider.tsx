import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useIsMobile } from '@/hooks/use-media-query';
import { getUIPreferences, setUIPreferences } from '@/lib/ui-preferences';

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
  isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

function adaptiveDefaultCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
  } catch {
    return false;
  }
}

function initialCollapsed(): boolean {
  const stored = getUIPreferences().sidebarCollapsed;
  if (typeof stored === 'boolean') return stored;
  return adaptiveDefaultCollapsed();
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsedState] = useState<boolean>(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    setUIPreferences({ sidebarCollapsed: value });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      setUIPreferences({ sidebarCollapsed: next });
      return next;
    });
  }, []);

  useEffect(() => {
    if (isMobile) {
      setCollapsedState(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (isMobile) {
          setMobileOpen((open) => !open);
        } else {
          toggleCollapsed();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isMobile, toggleCollapsed]);

  const value = useMemo<SidebarContextType>(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      isMobile,
    }),
    [collapsed, setCollapsed, toggleCollapsed, mobileOpen, isMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextType {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
