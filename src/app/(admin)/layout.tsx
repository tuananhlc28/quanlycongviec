import AdminSidebar from '@/components/layout/AdminSidebar';
import KeyboardShortcuts from '@/components/shared/KeyboardShortcuts';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#0a0e1a]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 relative">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
      <KeyboardShortcuts />
    </div>
  );
}
