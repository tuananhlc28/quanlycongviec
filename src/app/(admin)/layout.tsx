'use client';

import { useState } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import KeyboardShortcuts from '@/components/shared/KeyboardShortcuts';
import CommandPalette from '@/components/shared/CommandPalette';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[#0a0e1a]">
      <AdminSidebar />
      <main className="flex-1 min-w-0 relative">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
      <KeyboardShortcuts onOpenCommandPalette={() => setCmdOpen(true)} />
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </div>
  );
}
