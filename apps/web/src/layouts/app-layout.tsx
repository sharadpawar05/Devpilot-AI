import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';

export function AppLayout() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
