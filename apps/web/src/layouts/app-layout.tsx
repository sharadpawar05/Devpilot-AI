import { Outlet } from 'react-router-dom';
import { SidebarProvider, Sidebar, TopNavigation, BottomNavigation } from '@/components/navigation';
import { CommandPaletteProvider, CommandPalette } from '@/components/command-palette';

export function AppLayout() {
  return (
    <CommandPaletteProvider>
      <SidebarProvider>
        <div className="flex h-screen flex-col overflow-hidden">
          <TopNavigation />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main
              className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-14 md:pb-0"
              aria-label="Main content"
            >
              <Outlet />
            </main>
          </div>
          <BottomNavigation />
        </div>
        <CommandPalette />
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
