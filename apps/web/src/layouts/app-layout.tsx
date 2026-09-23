import { Outlet } from 'react-router-dom';
import { SidebarProvider, Sidebar, TopNavigation } from '@/components/navigation';
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
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
              aria-label="Main content"
            >
              <Outlet />
            </main>
          </div>
        </div>
        <CommandPalette />
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
