'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, X, Loader2, ArrowUp, ArrowDown, CornerDownLeft,
  ShoppingCart, Users, Key, Package, BarChart3, Shield,
  DollarSign, Settings, Plug, RotateCcw, ClipboardList,
  TrendingUp, Plus
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'order' | 'customer' | 'service' | 'source';
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  status?: string;
  tag?: string;
}

interface SearchResultGroup {
  orders: SearchResult[];
  customers: SearchResult[];
  services: SearchResult[];
  sources: SearchResult[];
}

const QUICK_ACTIONS = [
  { icon: '🛒', label: 'Tạo đơn hàng mới', href: '/admin/orders?create=true', shortcut: 'N', iconComp: Plus },
  { icon: '📊', label: 'Dashboard', href: '/admin/dashboard', iconComp: BarChart3 },
  { icon: '🛒', label: 'Đơn hàng', href: '/admin/orders', iconComp: ShoppingCart },
  { icon: '👥', label: 'Khách hàng', href: '/admin/customers', iconComp: Users },
  { icon: '🛡️', label: 'Xử lý sau bán', href: '/admin/warranty', iconComp: Shield },
  { icon: '💸', label: 'Quản lý hoàn tiền', href: '/admin/refunds', iconComp: DollarSign },
  { icon: '🔄', label: 'Quản lý tài khoản', href: '/admin/subscriptions', iconComp: RotateCcw },
  { icon: '💳', label: 'Công nợ', href: '/admin/debts', iconComp: DollarSign },
  { icon: '📈', label: 'Biểu đồ thống kê', href: '/admin/reports', iconComp: TrendingUp },
  { icon: '🛍️', label: 'Dịch vụ', href: '/admin/services', iconComp: Key },
  { icon: '📦', label: 'Nguồn hàng', href: '/admin/sources', iconComp: Plug },
  { icon: '📋', label: 'Nhật ký', href: '/admin/logs', iconComp: ClipboardList },
  { icon: '⚙️', label: 'Cài đặt', href: '/admin/settings', iconComp: Settings },
];

const TYPE_LABELS: Record<string, string> = {
  order: '🔑 Đơn hàng',
  customer: '👤 Khách hàng',
  service: '🛍️ Dịch vụ',
  source: '📦 Nguồn hàng',
};

export default function CommandPalette({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultGroup | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Flatten all results for keyboard navigation
  const allResults: SearchResult[] = results
    ? [
        ...results.orders,
        ...results.customers,
        ...results.services,
        ...results.sources,
      ]
    : [];

  const quickActionItems = QUICK_ACTIONS.map((a, i) => ({ ...a, _idx: i }));

  // Toggle open/close with Ctrl+K, also listen for close event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
    setQuery('');
    setResults(null);
    setActiveIndex(0);
  }, []);

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/global-search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => doSearch(query.trim()), 300);
    } else {
      setResults(null);
      setLoading(false);
    }
  }, [query, doSearch]);

  // Navigate with keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = query.trim().length < 2 ? quickActionItems.length : allResults.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim().length < 2) {
        const item = quickActionItems[activeIndex];
        if (item) {
          router.push(item.href);
          onClose?.();
        }
      } else {
        const item = allResults[activeIndex];
        if (item) {
          router.push(item.href);
          onClose?.();
        }
      }
    }
  };

  const handleResultClick = (href: string) => {
    router.push(href);
    onClose?.();
  };

  // Always rendered since parent controls visibility
  const hasResults = results && (
    results.orders.length > 0 ||
    results.customers.length > 0 ||
    results.services.length > 0 ||
    results.sources.length > 0
  );

  // Group index offset for keyboard nav
  let resultOffset = 0;
  const getGroupOffset = (type: keyof SearchResultGroup) => {
    let offset = 0;
    if (type === 'customers') offset = results?.orders.length || 0;
    if (type === 'services') offset = (results?.orders.length || 0) + (results?.customers.length || 0);
    if (type === 'sources') offset = (results?.orders.length || 0) + (results?.customers.length || 0) + (results?.services.length || 0);
    return offset;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => onClose?.()}
      />

      {/* Palette box */}
      <div className="relative w-full max-w-xl bg-[#0f1320] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden animate-fade-in">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
          {loading ? (
            <Loader2 className="w-4.5 h-4.5 text-indigo-400 flex-shrink-0 animate-spin" />
          ) : (
            <Search className="w-4.5 h-4.5 text-slate-500 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm đơn hàng, khách hàng, dịch vụ... hoặc nhập lệnh"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded text-[9px] bg-white/8 text-slate-400 font-mono border border-white/10">ESC</kbd>
            {query && (
              <button onClick={() => { setQuery(''); setResults(null); }} className="p-0.5 rounded text-slate-500 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results / Quick Actions */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {/* Quick actions when no query */}
          {query.trim().length < 2 && (
            <div>
              <p className="px-4 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">Điều hướng nhanh</p>
              {quickActionItems.map((action, i) => (
                <button
                  key={action.href}
                  onClick={() => handleResultClick(action.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all cursor-pointer text-left ${
                    i === activeIndex ? 'bg-indigo-500/15 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-base w-5 text-center leading-none flex-shrink-0">{action.icon}</span>
                  <span className="flex-1 font-medium">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded text-[9px] bg-white/8 text-slate-500 font-mono border border-white/10">
                      Ctrl+{action.shortcut}
                    </kbd>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {query.trim().length >= 2 && (
            <>
              {loading && !hasResults && (
                <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tìm kiếm...
                </div>
              )}

              {!loading && !hasResults && (
                <div className="text-center py-8 text-slate-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Không tìm thấy kết quả cho &quot;{query}&quot;</p>
                  <p className="text-xs mt-1 text-slate-600">Thử tìm với từ khóa khác</p>
                </div>
              )}

              {hasResults && results && (
                <>
                  {(['orders', 'customers', 'services', 'sources'] as (keyof SearchResultGroup)[]).map(type => {
                    const group = results[type];
                    if (!group || group.length === 0) return null;
                    const offset = getGroupOffset(type);
                    return (
                      <div key={type}>
                        <p className="px-4 pt-3 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          {TYPE_LABELS[type]}
                        </p>
                        {group.map((item, idx) => {
                          const globalIdx = offset + idx;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleResultClick(item.href)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all cursor-pointer text-left ${
                                globalIdx === activeIndex ? 'bg-indigo-500/15 text-white' : 'text-slate-300 hover:bg-white/5'
                              }`}
                            >
                              <span className="text-base w-5 text-center leading-none flex-shrink-0">{item.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold truncate">{item.title}</p>
                                <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                              </div>
                              {item.status && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/8 text-slate-400 border border-white/10 flex-shrink-0">
                                  {item.status}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-white/8 flex items-center gap-4 text-[10px] text-slate-600">
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> Di chuyển</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> Mở</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-white/5 rounded font-mono text-[9px] border border-white/10">ESC</kbd> Đóng</span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-white/5 rounded font-mono text-[9px] border border-white/10">Ctrl</kbd>+
            <kbd className="px-1 py-0.5 bg-white/5 rounded font-mono text-[9px] border border-white/10">K</kbd>
            để mở/đóng
          </span>
        </div>
      </div>
    </div>
  );
}
