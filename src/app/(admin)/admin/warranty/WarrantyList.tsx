'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert, Search, ChevronDown, ChevronUp, Loader2, Download,
  CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateShort, getSourceRefundLabel } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';

interface WarrantyListProps {
  initialOrders: any[];
  supplierSources: { id: string; name: string }[];
  services: { id: string; name: string; logo: string | null }[];
  stats: {
    total: number;
    warranty: number;
    pendingSource: number;
    pendingRefund: number;
    done: number;
    rejected: number;
    totalRefundAmount: number;
    totalSourceRefund: number;
  };
}

export default function WarrantyList({ initialOrders, supplierSources, services, stats: initialStats }: WarrantyListProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSourceId, setBulkSourceId] = useState('');
  const [pageSize, setPageSize] = useState(50);

  // Derived stats from current orders (always live)
  const stats = useMemo(() => ({
    total: orders.length,
    warranty: orders.filter(o => o.status === 'WARRANTY').length,
    pendingSource: orders.filter(o => o.status === 'WARRANTY_PENDING_SOURCE').length,
    pendingRefund: orders.filter(o => o.status === 'WARRANTY_PENDING_REFUND').length,
    done: orders.filter(o => o.status === 'WARRANTY_DONE').length,
    rejected: orders.filter(o => o.status === 'WARRANTY_REJECTED').length,
    totalRefundAmount: orders.reduce((sum, o) => sum + (o.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0), 0),
    totalSourceRefund: orders.reduce((sum, o) => sum + (o.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0), 0),
  }), [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (sourceFilter && o.supplierSourceId !== sourceFilter) return false;
      if (serviceFilter && o.serviceId !== serviceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const match =
          o.customer?.name?.toLowerCase().includes(q) ||
          o.customer?.phone?.includes(q) ||
          o.orderCode?.toLowerCase().includes(q) ||
          o.service?.name?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, sourceFilter, serviceFilter]);

  // Group by customer
  const groupedByCustomer = useMemo(() => {
    const map = new Map<string, { customer: any; orders: any[]; totalRefund: number; totalSourceRefund: number; totalProfit: number }>();
    for (const order of filteredOrders) {
      const cId = order.customerId; // always use ID
      if (!map.has(cId)) {
        map.set(cId, { customer: order.customer, orders: [], totalRefund: 0, totalSourceRefund: 0, totalProfit: 0 });
      }
      const entry = map.get(cId)!;
      entry.orders.push(order);
      const refundTotal = order.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
      const sourceTotal = order.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0;
      entry.totalRefund += refundTotal;
      entry.totalSourceRefund += sourceTotal;
      entry.totalProfit += (order.salePrice - order.costPrice - refundTotal + sourceTotal);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].orders.length - a[1].orders.length)
      .slice(0, pageSize);
  }, [filteredOrders, pageSize]);

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  };

  const toggleSelect = (orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  /**
   * handleBulkAction — cập nhật state tại chỗ sau khi API thành công
   * Không gọi router.refresh() để tránh re-render toàn trang
   */
  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    setBulkLoading(true);

    const actionMap: Record<string, string> = {
      report_error: 'STATUS_WARRANTY',
      pending_source: 'STATUS_PENDING_SOURCE',
      pending_refund: 'STATUS_PENDING_REFUND',
      done: 'STATUS_DONE',
      rejected: 'STATUS_REJECTED',
      change_source: 'CHANGE_SOURCE',
    };

    const statusMap: Record<string, string> = {
      report_error: 'WARRANTY',
      pending_source: 'WARRANTY_PENDING_SOURCE',
      pending_refund: 'WARRANTY_PENDING_REFUND',
      done: 'WARRANTY_DONE',
      rejected: 'WARRANTY_REJECTED',
    };

    const selectedArray = Array.from(selectedIds);

    try {
      const res = await fetch('/api/admin/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedArray,
          action: actionMap[bulkAction] || bulkAction,
          payload: {
            note: bulkNote,
            supplierSourceId: bulkSourceId || undefined,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const { success, failed, errors } = data;

        // Update state inline — no router.refresh() needed
        if (bulkAction === 'change_source' && bulkSourceId) {
          const newSource = supplierSources.find(s => s.id === bulkSourceId);
          setOrders(prev => prev.map(o =>
            selectedArray.includes(o.id)
              ? { ...o, supplierSourceId: bulkSourceId, supplierSourceName: newSource?.name || o.supplierSourceName }
              : o
          ));
        } else if (statusMap[bulkAction]) {
          const newStatus = statusMap[bulkAction];
          const successSet = new Set(errors?.map((e: any) => e.orderId) || []);
          setOrders(prev => prev.map(o =>
            selectedArray.includes(o.id) && !successSet.has(o.id)
              ? { ...o, status: newStatus }
              : o
          ));
        }

        if (success > 0) toast.success(`✅ ${success} đơn xử lý thành công`);
        if (failed > 0) {
          const errNames = errors?.slice(0, 3).map((e: any) => e.orderCode).join(', ');
          toast.error(`❌ ${failed} đơn lỗi: ${errNames}${failed > 3 ? '...' : ''}`);
        }

        setSelectedIds(new Set());
        setBulkAction('');
        setBulkNote('');
        setBulkSourceId('');
      } else {
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBulkLoading(false);
    }
  }, [bulkAction, selectedIds, bulkNote, bulkSourceId, supplierSources]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) { toast.error('Không có dữ liệu'); return; }
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Dịch vụ', 'Gói', 'Nguồn', 'Giá bán', 'Giá vốn', 'Hoàn khách', 'Nguồn hoàn', 'Lợi nhuận', 'Trạng thái', 'Ngày cập nhật'];
    const rows = filteredOrders.map(o => {
      const refund = o.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
      const srcRefund = o.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0;
      return [o.orderCode, o.customer?.name, o.customer?.phone || '', o.service?.name, o.packageName, o.supplierSourceName || '', o.salePrice, o.costPrice, refund, srcRefund, o.salePrice - o.costPrice - refund + srcRefund, ORDER_STATUS_LABELS[o.status] || o.status, formatDateShort(o.updatedAt)];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-hanh-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-blue-400" />
            🛡️ Quản lý Bảo hành
          </h1>
          <p className="text-sm text-slate-400 mt-1">Theo dõi đơn lỗi, xử lý hoàn tiền theo quy trình: Báo lỗi → Chờ nguồn → Chờ hoàn khách → Hoàn tất</p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer self-start">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Tổng đơn lỗi', value: stats.total, color: 'text-white' },
          { label: 'Khách báo lỗi', value: stats.warranty, color: 'text-blue-400' },
          { label: 'Chờ nguồn', value: stats.pendingSource, color: 'text-purple-400' },
          { label: 'Chờ hoàn khách', value: stats.pendingRefund, color: 'text-orange-400' },
          { label: 'Hoàn tất', value: stats.done, color: 'text-emerald-400' },
          { label: 'Từ chối', value: stats.rejected, color: 'text-red-400' },
          { label: 'Hoàn khách', value: formatCurrency(stats.totalRefundAmount), color: 'text-rose-400', isText: true },
          { label: 'Nguồn hoàn', value: formatCurrency(stats.totalSourceRefund), color: 'text-emerald-400', isText: true },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.color}`}>{(s as any).isText ? s.value : `${s.value} đơn`}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" placeholder="Tìm khách, SĐT, mã đơn..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="WARRANTY">🔵 Khách báo lỗi</option>
            <option value="WARRANTY_PENDING_SOURCE">🟣 Chờ nguồn hoàn</option>
            <option value="WARRANTY_PENDING_REFUND">🟠 Chờ hoàn khách</option>
            <option value="WARRANTY_DONE">✅ Hoàn tất</option>
            <option value="WARRANTY_REJECTED">⛔ Từ chối</option>
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none">
            <option value="">Tất cả nguồn</option>
            {supplierSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none">
            <option value="">Tất cả dịch vụ</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Tổng: <strong className="text-white">{filteredOrders.length}</strong> đơn · <strong className="text-white">{groupedByCustomer.length}</strong> khách</span>
          <div className="flex items-center gap-2">
            <span>Hiển thị:</span>
            {[10, 50, 100, 300].map(n => (
              <button key={n} onClick={() => setPageSize(n)} className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${pageSize === n ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-indigo-400">Đã chọn {selectedIds.size} đơn</span>
          <select value={bulkAction} onChange={e => setBulkAction(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-[#131722] border border-white/10 text-white">
            <option value="">Chọn thao tác...</option>
            <option value="report_error">📌 Báo lỗi</option>
            <option value="pending_source">🟣 Chờ nguồn hoàn</option>
            <option value="pending_refund">🟠 Chờ hoàn khách</option>
            <option value="done">✅ Hoàn tất</option>
            <option value="rejected">⛔ Từ chối</option>
            <option value="change_source">🔄 Đổi nguồn</option>
          </select>
          {bulkAction === 'change_source' && (
            <select value={bulkSourceId} onChange={e => setBulkSourceId(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[#131722] border border-white/10 text-white">
              <option value="">Chọn nguồn...</option>
              {supplierSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <input type="text" placeholder="Ghi chú (tùy chọn)" value={bulkNote} onChange={e => setBulkNote(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 flex-1 min-w-[150px]" />
          <button onClick={handleBulkAction} disabled={!bulkAction || bulkLoading}
            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg cursor-pointer flex items-center gap-1">
            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Thực hiện
          </button>
          <button onClick={() => { setSelectedIds(new Set()); setBulkAction(''); }} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer">Bỏ chọn</button>
        </div>
      )}

      {/* Grouped warranty list */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-2">
          <input type="checkbox" checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
            onChange={selectAll} className="w-4 h-4 rounded border-white/20 accent-indigo-500 cursor-pointer" />
          <span className="text-xs text-slate-400">Chọn tất cả</span>
        </div>

        {groupedByCustomer.map(([customerId, group]) => {
          const isExpanded = expandedCustomers.has(customerId);
          const profitColor = group.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400';

          return (
            <div key={customerId} className="rounded-2xl bg-[#131722]/50 border border-white/5 overflow-hidden">
              <button onClick={() => toggleCustomer(customerId)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all cursor-pointer text-left">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                    {group.customer?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{group.customer?.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {group.customer?.phone || 'Không có SĐT'} · {group.orders.length} đơn lỗi
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Hoàn khách</p>
                    <p className="text-rose-400 font-bold">{formatCurrency(group.totalRefund)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Nguồn hoàn</p>
                    <p className="text-emerald-400 font-bold">{formatCurrency(group.totalSourceRefund)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Lợi nhuận</p>
                    <p className={`font-bold ${profitColor}`}>{formatCurrency(group.totalProfit)}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5">
                  {group.orders.map((order: any) => {
                    const latestRefund = order.refundHistories?.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    const durationDays = order.durationDays || 30;

                    let daysUsed = 0, daysRemaining = durationDays;
                    if (latestRefund) {
                      daysUsed = latestRefund.daysUsed;
                      daysRemaining = latestRefund.daysRemaining;
                    } else {
                      const now2 = new Date();
                      const start = new Date(order.startDate);
                      daysUsed = Math.min(durationDays, Math.max(0, Math.floor((now2.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))));
                      daysRemaining = Math.max(0, durationDays - daysUsed);
                    }

                    const expectedRefund = latestRefund ? (latestRefund.autoRefundAmount || latestRefund.amount) : Math.round(daysRemaining * (order.salePrice / durationDays));
                    const actualRefund = order.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
                    const expectedSourceRefund = latestRefund ? latestRefund.sourceRefundExpected : Math.round(daysRemaining * (order.costPrice / durationDays));
                    const actualSourceRefund = order.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0;
                    const profit = order.salePrice - order.costPrice - actualRefund + actualSourceRefund;

                    const statusColor = ORDER_STATUS_COLORS[order.status] || '';
                    const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;

                    return (
                      <div key={order.id} className="flex items-center gap-4 px-4 py-3 border-b border-white/3 last:border-b-0 hover:bg-white/3 transition-all">
                        <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 rounded border-white/20 accent-indigo-500 cursor-pointer flex-shrink-0" />

                        <Link href={`/admin/warranty/${order.id}`} className="flex-1 grid grid-cols-12 gap-3 items-center text-xs">
                          <div className="col-span-3">
                            <span className="font-bold text-indigo-400">{order.orderCode}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-base">{order.service?.logo || '🔑'}</span>
                              <span className="text-slate-300 truncate font-semibold">{order.service?.name}</span>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">Nguồn: {order.supplierSourceName || 'Trực tiếp'}</p>
                          </div>

                          <div className="col-span-3 space-y-0.5">
                            <p className="text-slate-300 font-medium">Đã dùng: <strong className="text-amber-400 font-mono">{daysUsed}</strong> / {durationDays} ngày</p>
                            <p className="text-[10px] text-emerald-400 font-medium">Còn lại: <strong className="font-mono">{daysRemaining}</strong> ngày</p>
                            <p className="text-[9px] text-slate-500 font-mono">
                              Kích hoạt: {formatDateShort(order.startDate)} · Hạn: {formatDateShort(order.endDate)}
                            </p>
                          </div>

                          <div className="col-span-2 text-right space-y-1.5 font-mono">
                            <div>
                              <p className="text-slate-500 text-[8px] uppercase font-bold font-sans">Hoàn khách dự kiến</p>
                              <p className="text-rose-400/80 font-medium text-[10px]">{formatCurrency(expectedRefund)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[8px] uppercase font-bold font-sans">Hoàn khách thực tế</p>
                              <p className="text-rose-400 font-bold text-[11px]">{formatCurrency(actualRefund)}</p>
                            </div>
                          </div>

                          <div className="col-span-2 text-right space-y-1.5 font-mono">
                            <div>
                              <p className="text-slate-500 text-[8px] uppercase font-bold font-sans">Nguồn hoàn dự kiến</p>
                              <p className="text-emerald-400/80 font-medium text-[10px]">{formatCurrency(expectedSourceRefund)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500 text-[8px] uppercase font-bold font-sans">Nguồn hoàn thực tế</p>
                              <p className="text-emerald-400 font-bold text-[11px]">+{formatCurrency(actualSourceRefund)}</p>
                            </div>
                          </div>

                          <div className="col-span-2 text-right space-y-0.5">
                            <div className="flex flex-col items-end">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusColor}`}>{statusLabel}</span>
                              {latestRefund && (
                                <p className="text-[9px] text-slate-500 mt-0.5">{getSourceRefundLabel(latestRefund.sourceStatus)}</p>
                              )}
                            </div>
                            <div className="pt-0.5">
                              <p className={`font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(profit)}</p>
                              <span className={`text-[8px] font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {profit > 0 ? '🟢 Lãi' : profit < 0 ? '🔴 Lỗ' : '🟡 Hoà'}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {groupedByCustomer.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không có đơn bảo hành nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
