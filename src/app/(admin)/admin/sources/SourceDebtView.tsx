'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle, TrendingDown, RefreshCw, Box, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/lib/utils';

interface SourceDebtSummary {
  sourceId: string;
  sourceName: string;
  totalOrders: number;
  requestedOrders: number;
  pendingOrders: number;
  refundedOrders: number;
  rejectedOrders: number;
  totalExpectedRefund: number;
  totalActualRefund: number;
  totalDebt: number;
  totalRejectedRefund: number;
  profitImpact: number;
}

export default function SourceDebtView() {
  const [summaries, setSummaries] = useState<SourceDebtSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchSourceDebts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sources/debts');
      if (res.ok) {
        const data = await res.json();
        setSummaries(data.summaries || []);
      } else {
        toast.error('Không thể tải dữ liệu công nợ nguồn');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSourceDebts();
  }, []);

  const filteredSummaries = useMemo(() => {
    if (!search) return summaries;
    const term = search.toLowerCase();
    return summaries.filter((s) => s.sourceName.toLowerCase().includes(term));
  }, [summaries, search]);

  const totals = useMemo(() => {
    return filteredSummaries.reduce(
      (acc, curr) => {
        acc.totalOrders += curr.totalOrders;
        acc.requested += curr.requestedOrders;
        acc.pending += curr.pendingOrders;
        acc.refunded += curr.refundedOrders;
        acc.rejected += curr.rejectedOrders;
        acc.expected += curr.totalExpectedRefund;
        acc.actual += curr.totalActualRefund;
        acc.debt += curr.totalDebt;
        acc.rejectedRefund += curr.totalRejectedRefund;
        acc.profitImpact += curr.profitImpact;
        return acc;
      },
      {
        totalOrders: 0,
        requested: 0,
        pending: 0,
        refunded: 0,
        rejected: 0,
        expected: 0,
        actual: 0,
        debt: 0,
        rejectedRefund: 0,
        profitImpact: 0,
      }
    );
  }, [filteredSummaries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="ml-3 text-sm text-slate-400">Đang tải dữ liệu công nợ nguồn...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Tổng nguồn phải hoàn</span>
          <span className="text-2xl font-bold text-indigo-400 mt-2">{formatCurrency(totals.expected)}</span>
        </div>
        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col justify-between">
          <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Đã hoàn thực tế</span>
          <span className="text-2xl font-bold text-emerald-400 mt-2">{formatCurrency(totals.actual)}</span>
        </div>
        <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex flex-col justify-between">
          <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">Còn nợ (Chưa hoàn)</span>
          <span className="text-2xl font-extrabold text-amber-400 mt-2">{formatCurrency(totals.debt)}</span>
        </div>
        <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10 flex flex-col justify-between">
          <span className="text-xs text-red-400 font-bold uppercase tracking-wider">Tiền nguồn từ chối</span>
          <span className="text-2xl font-bold text-red-400 mt-2">{formatCurrency(totals.rejectedRefund)}</span>
        </div>
        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col justify-between">
          <span className="text-xs text-rose-400 font-bold uppercase tracking-wider">Thiệt hại từ chối bảo hành</span>
          <span className="text-2xl font-bold text-rose-400 mt-2">{formatCurrency(totals.profitImpact)}</span>
        </div>
      </div>

      {/* Control row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#131722]/50 p-4 rounded-2xl border border-white/5">
        <input
          type="text"
          placeholder="Tìm kiếm theo tên nguồn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />

        <button
          onClick={fetchSourceDebts}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Làm mới
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3.5 w-12 text-center">STT</th>
              <th className="px-4 py-3.5">Nguồn hàng</th>
              <th className="px-4 py-3.5 text-center">Tổng đơn lỗi</th>
              <th className="px-4 py-3.5 text-center">Đang chờ</th>
              <th className="px-4 py-3.5 text-center">Đã hoàn</th>
              <th className="px-4 py-3.5 text-center">Từ chối</th>
              <th className="px-4 py-3.5 text-right">Dự kiến hoàn</th>
              <th className="px-4 py-3.5 text-right">Đã hoàn</th>
              <th className="px-4 py-3.5 text-right">Còn nợ</th>
              <th className="px-4 py-3.5 text-right">Nguồn từ chối</th>
              <th className="px-4 py-3.5 text-right">Thiệt hại</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {filteredSummaries.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500 italic">
                  Không tìm thấy dữ liệu công nợ nguồn nào
                </td>
              </tr>
            ) : (
              filteredSummaries.map((s, idx) => (
                <tr key={s.sourceId} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-bold text-white">{s.sourceName}</td>
                  <td className="px-4 py-3.5 text-center text-slate-300">{s.totalOrders}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                      {s.pendingOrders}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      {s.refundedOrders}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                      {s.rejectedOrders}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                    {formatCurrency(s.totalExpectedRefund)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-emerald-400">
                    {formatCurrency(s.totalActualRefund)}
                  </td>
                  <td
                    className={`px-4 py-3.5 text-right font-mono font-bold ${
                      s.totalDebt > 0 ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {formatCurrency(s.totalDebt)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-red-400 font-bold">
                    {formatCurrency(s.totalRejectedRefund)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-rose-400">
                    {formatCurrency(s.profitImpact)}
                  </td>
                </tr>
              ))
            )}

            {/* Total Row */}
            {filteredSummaries.length > 0 && (
              <tr className="bg-white/2 font-bold border-t border-white/10">
                <td colSpan={2} className="px-4 py-3.5 text-white">Tổng cộng</td>
                <td className="px-4 py-3.5 text-center text-white">{totals.totalOrders}</td>
                <td className="px-4 py-3.5 text-center text-purple-300">{totals.pending}</td>
                <td className="px-4 py-3.5 text-center text-emerald-300">{totals.refunded}</td>
                <td className="px-4 py-3.5 text-center text-rose-300">{totals.rejected}</td>
                <td className="px-4 py-3.5 text-right font-mono text-slate-300">
                  {formatCurrency(totals.expected)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-emerald-400">
                  {formatCurrency(totals.actual)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-amber-400">{formatCurrency(totals.debt)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-red-400">{formatCurrency(totals.rejectedRefund)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-rose-400">
                  {formatCurrency(totals.profitImpact)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
