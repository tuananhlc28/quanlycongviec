'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet, Search, Loader2, ArrowRight, AlertTriangle, RefreshCw, Clock, CheckCircle, TrendingDown, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';

interface DebtDashboard {
  totalDebtAmount: number;
  unpaidOrdersCount: number;
  debtCustomersCount: number;
  totalCostOccupied: number;
  totalExpectedProfit: number;
  debtOver1DayCount: number;
  debtOver7DaysCount: number;
  topDebtors: {
    customerId: string;
    customerName: string;
    totalDebt: number;
    orderCount: number;
  }[];
}

interface DebtEntry {
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  orderCount: number;
  totalDebt: number;
  maxDebtDays: number;
  oldestOrderDate: string;
}

export default function DebtsPage() {
  const [dashboard, setDashboard] = useState<DebtDashboard | null>(null);
  const [debts, setDebts] = useState<DebtEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ search, page: page.toString(), limit: '20' }).toString();
      const res = await fetch(`/api/admin/debts?${query}`);
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        setDebts(data.debts);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        toast.error('Không thể tải dữ liệu công nợ');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  // Debt days color helper
  const getDebtDaysColor = (days: number) => {
    if (days <= 0) return 'text-slate-400';
    if (days <= 3) return 'text-amber-400';
    if (days <= 7) return 'text-orange-400';
    return 'text-rose-400 font-bold';
  };

  const getDebtDaysBgColor = (days: number) => {
    if (days <= 0) return 'bg-slate-500/10 border-slate-500/20';
    if (days <= 3) return 'bg-amber-500/10 border-amber-500/20';
    if (days <= 7) return 'bg-orange-500/10 border-orange-500/20';
    return 'bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Wallet className="w-7 h-7 text-amber-400" />
            💳 Quản lý Công nợ
          </h1>
          <p className="text-sm text-slate-400 mt-1">Theo dõi thanh toán, nhắc nợ và quản lý thu tiền khách hàng</p>
        </div>
        <button onClick={fetchDebts} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer" title="Tải lại">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dashboard Cards */}
      {dashboard && (
        <>
          {/* Top metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Tổng khách còn nợ
              </p>
              <p className="text-2xl font-black text-blue-400 mt-2">{dashboard.debtCustomersCount} khách</p>
            </div>
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/15">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Tổng đơn còn nợ
              </p>
              <p className="text-2xl font-black text-amber-400 mt-2">{dashboard.unpaidOrdersCount} đơn</p>
            </div>
            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/15">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Tổng tiền khách nợ
              </p>
              <p className="text-2xl font-black text-rose-400 mt-2">{formatCurrency(dashboard.totalDebtAmount)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/15">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Giá vốn bị chiếm dụng
              </p>
              <p className="text-2xl font-black text-purple-400 mt-2">{formatCurrency(dashboard.totalCostOccupied)}</p>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> LN dự kiến khi thu đủ
              </p>
              <p className="text-2xl font-black text-emerald-400 mt-2">{formatCurrency(dashboard.totalExpectedProfit)}</p>
            </div>
          </div>

          {/* Debt duration statistics */}
          <div className="p-5 rounded-2xl bg-[#131722]/60 border border-white/5">
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              ⏱️ Thống kê thời gian nợ
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-orange-500/5 border-orange-500/15 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Số đơn đã nợ trên 1 ngày</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Đơn nợ đã kích hoạt từ 24h trở lên</p>
                </div>
                <p className="text-3xl font-black text-orange-400">{dashboard.debtOver1DayCount} đơn</p>
              </div>
              <div className="p-4 rounded-xl border bg-rose-500/5 border-rose-500/15 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Số đơn đã nợ trên 7 ngày</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Nợ lâu ngày, cần liên hệ trực tiếp nhắc nợ</p>
                </div>
                <p className="text-3xl font-black text-rose-400">{dashboard.debtOver7DaysCount} đơn</p>
              </div>
            </div>
          </div>

          {/* Top Debtors */}
          {dashboard.topDebtors.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#131722]/60 border border-white/5">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-rose-400" />
                🏆 Top 5 khách nợ nhiều nhất
              </h2>
              <div className="space-y-2">
                {dashboard.topDebtors.map((d, i) => (
                  <div key={d.customerId} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-rose-500 text-white' : i === 1 ? 'bg-orange-500 text-white' : i === 2 ? 'bg-amber-500 text-white' : 'bg-slate-500/30 text-slate-400'}`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-white">{d.customerName}</p>
                        <p className="text-[10px] text-slate-500">{d.orderCount} đơn nợ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-rose-400 text-sm">{formatCurrency(d.totalDebt)}</p>
                      <Link href={`/admin/debts/${d.customerId}`} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all border border-indigo-500/20">
                        Xem →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Search */}
      <div className="p-4 rounded-2xl bg-[#131722]/50 border border-white/5 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm theo tên khách hàng hoặc số điện thoại..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500">{total} khách</span>
      </div>

      {/* Debt list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden bg-[#131722]/30">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Khách hàng</th>
                <th className="px-6 py-4 text-right">Số đơn nợ</th>
                <th className="px-6 py-4 text-right">Tổng tiền nợ</th>
                <th className="px-6 py-4 text-center">Thời gian nợ</th>
                <th className="px-6 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {debts.map((d, idx) => (
                <tr key={d.customerId} className="hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                    {(page - 1) * 20 + idx + 1}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-white">{d.customerName}</p>
                    <p className="text-[11px] text-slate-500">{d.customerPhone || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-amber-400">{d.orderCount} đơn</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-rose-400">{formatCurrency(d.totalDebt)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${getDebtDaysBgColor(d.maxDebtDays)} ${getDebtDaysColor(d.maxDebtDays)}`}>
                      {d.maxDebtDays === 0 ? 'Hôm nay' : `Đã nợ ${d.maxDebtDays} ngày`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Link
                      href={`/admin/debts/${d.customerId}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Chi tiết
                    </Link>
                  </td>
                </tr>
              ))}

              {debts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-500/40" />
                    <p className="text-sm">Không có công nợ nào {search ? `với từ khóa "${search}"` : ''}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            ← Trước
          </button>
          <span className="text-xs text-slate-400">Trang {page} / {totalPages}</span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
          >
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}
