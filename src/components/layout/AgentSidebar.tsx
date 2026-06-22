'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  Percent,
  Headphones,
  ChevronLeft,
  LogOut,
  ShoppingBag,
  Menu,
  PlusCircle,
  Share2,
} from 'lucide-react';

const menuItems = [
  { group: 'Tổng quan', items: [
    { href: '/agent/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  ]},
  { group: 'Đơn hàng', items: [
    { href: '/agent/orders', label: 'Đơn hàng của tôi', icon: ShoppingCart },
    { href: '/agent/orders/create', label: 'Tạo đơn cho khách', icon: PlusCircle },
  ]},
  { group: 'Khách hàng & Tài chính', items: [
    { href: '/agent/customers', label: 'Khách hàng của tôi', icon: Users },
    { href: '/agent/wallet', label: 'Ví tiền & Nạp tiền', icon: Wallet },
    { href: '/agent/referrals', label: 'Giới thiệu khách mới', icon: Share2 },
  ]},
  { group: 'Hỗ trợ', items: [
    { href: '/agent/tickets', label: 'Hỗ trợ kỹ thuật', icon: Headphones },
  ]},
];

export default function AgentSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <Link href="/agent/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-sm font-bold text-white">MMO Services</span>
              <p className="text-[10px] text-slate-500 font-medium">Đại lý / CTV</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Wallet balance */}
      {!collapsed && (
        <div className="mx-3 mt-4 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Số dư ví</p>
          <p className="text-lg font-bold text-white">0 ₫</p>
          <Link
            href="/agent/wallet"
            className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            Nạp tiền
          </Link>
        </div>
      )}

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuItems.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                {group.group}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/agent/orders');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-3' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        <Link
          href="/"
          className={`sidebar-link mb-1 ${collapsed ? 'justify-center px-3' : ''}`}
        >
          <ShoppingBag className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Xem storefront</span>}
        </Link>
        {session?.user && (
          <div className={`flex items-center gap-3 p-2 rounded-lg ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{session.user.role}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass text-slate-400 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 z-50 bg-[#0f1320] border-r border-white/5 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 bottom-0 bg-[#0f1320] border-r border-white/5 transition-all duration-300 z-30 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Spacer */}
      <div className={`hidden lg:block transition-all duration-300 flex-shrink-0 ${collapsed ? 'w-[72px]' : 'w-64'}`} />
    </>
  );
}
