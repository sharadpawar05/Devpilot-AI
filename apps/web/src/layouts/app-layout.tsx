import { Outlet } from 'react-router-dom';
import { SidebarProvider, Sidebar, TopNavigation } from '@/components/navigation';

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <TopNavigation />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
