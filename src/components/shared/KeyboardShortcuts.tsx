'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl + K: Focus search bar or show help
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Tìm"], input[placeholder*="search"], input[type="text"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          toast.success('🔍 Đã tập trung vào thanh tìm kiếm', { id: 'focus-search', duration: 1500 });
        } else {
          setShowHelp(prev => !prev);
        }
      }

      // 2. Ctrl + N: Open new order form or page
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const createOrderBtn = document.querySelector('button[title*="Tạo đơn"], button[title*="create"], a[href*="create=true"]') as HTMLButtonElement | HTMLAnchorElement;
        if (createOrderBtn) {
          createOrderBtn.click();
        } else {
          router.push('/admin/orders?create=true');
        }
        toast.success('🛒 Đang mở form tạo đơn mới', { id: 'new-order-shortcut', duration: 1500 });
      }

      // 3. Ctrl + S: Save active form
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const submitBtn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
        if (submitBtn) {
          submitBtn.click();
          toast.success('💾 Đang lưu dữ liệu...', { id: 'save-shortcut', duration: 1500 });
        }
      }

      // 4. Esc: Close modals, menus, help
      if (e.key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
          e.preventDefault();
          return;
        }
        const closeBtn = document.querySelector('button[title*="Đóng"], button[title*="close"], button svg[class*="lucide-x"]') as HTMLButtonElement;
        if (closeBtn) {
          closeBtn.click();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, showHelp]);

  return (
    <>
      {/* Floating help button for solo admin */}
      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 right-4 z-40 p-2.5 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-lg transition-all hover:scale-105 group border border-indigo-400/20"
        title="Phím tắt hệ thống"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap text-xs font-semibold pl-0 group-hover:pl-2">
          Phím tắt
        </span>
      </button>

      {/* Shortcuts Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white animate-fade-in">
            <button
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-4">⌨️ Phím tắt hệ thống CRM</h3>
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Tìm kiếm / Focus input</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl + K</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Tạo đơn hàng mới</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl + N</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Lưu thông tin / Submit form</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl + S</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-white/5">
                <span>Đóng Modal / Thoát</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-[10px]">Esc</kbd>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span>Xác nhận thông tin</span>
                <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-[10px]">Enter</kbd>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 mt-5 text-center">Tối ưu thao tác nhanh cho quản trị viên đơn lẻ.</p>
          </div>
        </div>
      )}
    </>
  );
}
