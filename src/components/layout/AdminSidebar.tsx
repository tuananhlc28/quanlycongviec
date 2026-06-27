'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import {
  BarChart3,
  ShoppingCart,
  Key,
  Users,
  DollarSign,
  TrendingUp,
  Settings,
  ChevronLeft,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  Plug,
  Bell,
  ClipboardList,
  RotateCcw,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

import { useTheme } from '@/components/providers/ThemeContext';

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expiringCount, setExpiringCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  // Fetch badge count for Thuê bao & Công nợ
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const subRes = await fetch('/api/admin/subscriptions/count');
        if (subRes.ok) {
          const data = await subRes.json();
          setExpiringCount(data.expiringCount || 0);
        }
      } catch { /* silent */ }

      try {
        const debtRes = await fetch('/api/admin/debts/count');
        if (debtRes.ok) {
          const data = await debtRes.json();
          setOverdueCount(data.count || 0);
        }
      } catch { /* silent */ }
    };

    fetchCounts();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { href: '/admin/dashboard',     label: '📊 Tổng quan',        icon: BarChart3 },
    { href: '/admin/reports',       label: '📈 Báo cáo hoàn tiền', icon: TrendingUp },
    { href: '/admin/customers',     label: '👥 Khách hàng',       icon: Users },
    { href: '/admin/orders',        label: '🛒 Đơn hàng',         icon: ShoppingCart },
    { href: '/admin/warranty',      label: '🛡️ Xử lý sau bán',    icon: ShieldAlert },
    { href: '/admin/debts',         label: '💳 Công nợ',          icon: Wallet, badge: overdueCount },
    { href: '/admin/services',      label: '🛍️ Dịch vụ',          icon: Key },
    { href: '/admin/sources',       label: '📦 Nguồn hàng',       icon: Plug },
    {
      href: '/admin/subscriptions',
      label: '🔄 Quản lý tài khoản',
      icon: RotateCcw,
      badge: expiringCount,
    },
    { href: '/admin/refunds',       label: '💸 Lịch sử hoàn tiền', icon: DollarSign },
    { href: '/admin/logs',          label: '📋 Nhật ký',          icon: ClipboardList },
    { href: '/admin/settings',      label: '⚙️ Cài đặt',          icon: Settings },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Key className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <span className="text-sm font-bold text-white">BanHangMMO</span>
              <p className="text-[10px] text-slate-500 font-medium">Quản trị hệ thống</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const badge = (item as any).badge;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-3' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {/* Badge số lượng */}
              {!collapsed && badge > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none ${
                  item.href === '/admin/debts'
                    ? 'bg-red-500 text-white'
                    : badge > 5 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {collapsed && badge > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] text-white flex items-center justify-center font-bold bg-red-500`}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5 relative">
        {session?.user && (
          <>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={`flex items-center gap-3 p-2 rounded-lg w-full text-left hover:bg-white/5 transition-all select-none cursor-pointer ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {session.user.name?.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{session.user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{session.user.email}</p>
                </div>
              )}
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className={`absolute bottom-full mb-2 w-56 py-2 rounded-xl bg-[#131722] border border-white/10 shadow-2xl z-50 animate-fade-in ${
                  collapsed ? 'left-4' : 'left-3'
                }`}>
                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-sm font-medium text-white">{session.user.name}</p>
                    <p className="text-xs text-slate-400">{session.user.email}</p>
                  </div>

                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Giao diện</p>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() => { setTheme('light'); setUserMenuOpen(false); }}
                        className={`flex flex-col items-center py-1.5 rounded text-[10px] border transition-all cursor-pointer ${
                          theme === 'light' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-white/2 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 mb-0.5 text-amber-500" />Sáng
                      </button>
                      <button
                        onClick={() => { setTheme('dark'); setUserMenuOpen(false); }}
                        className={`flex flex-col items-center py-1.5 rounded text-[10px] border transition-all cursor-pointer ${
                          theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-white/2 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 mb-0.5 text-indigo-400" />Tối
                      </button>
                      <button
                        onClick={() => { setTheme('system'); setUserMenuOpen(false); }}
                        className={`flex flex-col items-center py-1.5 rounded text-[10px] border transition-all cursor-pointer ${
                          theme === 'system' ? 'bg-slate-500/10 text-slate-300 border-slate-500/30' : 'bg-white/2 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5 mb-0.5 text-slate-400" />Hệ thống
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => signOut()}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 w-full transition-all text-left cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Đăng xuất
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
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
