'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  DollarSign, 
  Search, 
  Calendar, 
  ArrowLeft, 
  ArrowRight, 
  Loader2, 
  Download, 
  RefreshCw, 
  Info,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import TimeFilterDropdown, { TimeRange, DateRange } from '@/components/shared/TimeFilterDropdown';
import ColumnVisibilityToggle from '@/components/shared/ColumnVisibilityToggle';
import { saveColumnVisibility, loadColumnVisibility } from '@/lib/tableUtils';

interface RefundRecord {
  id: string;
  amount: number;
  daysUsed: number;
  daysRemaining: number;
  costPerDay: number;
  errorDate: string | null;
  operatorName: string | null;
  note: string | null;
  createdAt: string;
  sourceAmount: number;
  sourceRefundExpected: number;
  sourceRefundActual: number;
  sourceStatus: string;
  netProfitAfterRefund: number;
  order: {
    id: string;
    orderCode: string;
    packageName: string;
    supplierSourceName: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    salePrice: number;
    costPrice: number;
    profit: number;
    durationDays: number;
    customer: {
      name: string;
      phone: string | null;
    };
    service: {
      name: string;
      logo: string | null;
    };
  };
}

interface ServiceLookup {
  id: string;
  name: string;
}

const sourceStatusLabels: Record<string, string> = {
  NOT_REQUESTED: 'Chưa yêu cầu',
  REQUESTED: 'Đã yêu cầu',
  APPROVED: 'Đã yêu cầu', // legacy fallback
  REFUNDED: 'Đã hoàn tiền',
  REJECTED: 'Từ chối',
};

interface RefundDashboard {
  totalClientRefundActual: number;
  totalSourceRefundExpected: number;
  totalSourceRefundActual: number;
  totalSourceDebt: number;
  refundDiff: number;
  totalProfitAfterRefund: number;
  totalPending: number;
  totalRefundCount: number;
  totalClientRefundedCount: number;
  totalPendingSourceCount: number;
  totalPendingClientCount: number;
  totalRejectedSourceCount: number;
}

export default function AdminRefundsPage() {
  const router = useRouter();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [services, setServices] = useState<ServiceLookup[]>([]);
  const [refundDashboard, setRefundDashboard] = useState<RefundDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Time Filter States
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Column Visibility States
  const COLUMNS_CONFIG = [
    { id: 'createdAt', label: 'Ngày hoàn' },
    { id: 'orderCode', label: 'Mã đơn' },
    { id: 'customer', label: 'Khách hàng' },
    { id: 'service', label: 'Dịch vụ & Gói' },
    { id: 'financials', label: 'Giá bán / Vốn' },
    { id: 'amount', label: 'Hoàn khách' },
    { id: 'sourceRefund', label: 'Nguồn hoàn' },
    { id: 'netProfit', label: 'Lợi nhuận ròng' },
    { id: 'sourceStatus', label: 'Trạng thái nguồn' },
  ];
  const DEFAULT_COLUMNS = ['createdAt', 'orderCode', 'customer', 'service', 'financials', 'amount', 'sourceRefund', 'netProfit', 'sourceStatus'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadColumnVisibility('admin_refunds_columns');
    setVisibleColumns(saved.length > 0 ? saved : DEFAULT_COLUMNS);
  }, []);

  const handleToggleColumn = (colId: string) => {
    const next = visibleColumns.includes(colId)
      ? visibleColumns.filter(id => id !== colId)
      : [...visibleColumns, colId];
    setVisibleColumns(next);
    saveColumnVisibility('admin_refunds_columns', next);
  };

  // Sort states
  const [sortCol, setSortCol] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>('desc');

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol('createdAt');
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span className="ml-1 text-slate-500 hover:text-slate-300">⇅</span>;
    if (sortDir === 'asc') return <span className="ml-1 text-indigo-400">▲</span>;
    return <span className="ml-1 text-indigo-400">▼</span>;
  };

  // Editing state for source amount and status
  const [editingRefundId, setEditingRefundId] = useState<string | null>(null);
  const [editSourceAmount, setEditSourceAmount] = useState<number>(0);
  const [editSourceStatus, setEditSourceStatus] = useState<string>('NOT_REQUESTED');
  const [editNote, setEditNote] = useState<string>('');
  const [savingRefundId, setSavingRefundId] = useState<string | null>(null);

  const startEditing = (rh: RefundRecord) => {
    setEditingRefundId(rh.id);
    const initialAmount = (rh.sourceRefundActual !== undefined && rh.sourceRefundActual !== null && rh.sourceRefundActual !== 0)
      ? rh.sourceRefundActual
      : (rh.sourceRefundExpected || rh.sourceAmount || 0);
    setEditSourceAmount(initialAmount);
    setEditSourceStatus(rh.sourceStatus || 'NOT_REQUESTED');
    setEditNote(rh.note || '');
  };

  const handleUpdateRefund = async (refundId: string) => {
    if (savingRefundId) return;
    setSavingRefundId(refundId);
    try {
      const res = await fetch(`/api/admin/refunds/${refundId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceRefundActual: editSourceAmount,
          sourceStatus: editSourceStatus === 'APPROVED' ? 'REQUESTED' : editSourceStatus, // keep simplified mapping
          note: editNote,
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật nguồn hoàn thành công!');
        const updated = await res.json();
        setRefunds(prev => prev.map(rh => {
          if (rh.id === refundId) {
            return {
              ...rh,
              sourceAmount: updated.sourceAmount,
              sourceRefundActual: updated.sourceRefundActual,
              sourceStatus: updated.sourceStatus,
              netProfitAfterRefund: updated.netProfitAfterRefund,
              note: editNote,
            };
          }
          return rh;
        }));
        setEditingRefundId(null);
        router.refresh();
        fetchRefunds();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Lỗi khi cập nhật nguồn hoàn');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setSavingRefundId(null);
    }
  };

  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch lookups
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/admin/services');
        if (res.ok) {
          const data = await res.json();
          setServices(data.services || []);
        }
      } catch (err) {
        console.error('Failed to load services lookup:', err);
      }
    };
    fetchServices();
  }, []);

  // Fetch refund histories
  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search: debouncedSearch,
        serviceId: selectedService,
        dateStart,
        dateEnd,
        page: page.toString(),
        limit: '10',
        sortBy: sortCol,
        sortOrder: sortDir || 'desc',
      }).toString();

      const res = await fetch(`/api/admin/refunds?${query}`);
      if (res.ok) {
        const data = await res.json();
        setRefunds(data.refunds || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.dashboard) setRefundDashboard(data.dashboard);
      } else {
        toast.error('Không thể tải lịch sử hoàn tiền');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedService, dateStart, dateEnd, page, sortCol, sortDir]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  // Client-side CSV export
  const handleExportCSV = () => {
    if (refunds.length === 0) {
      toast.error('Không có dữ liệu hoàn tiền để xuất');
      return;
    }

    const headers = [
      'Ngày Hoàn Tiền',
      'Mã Đơn',
      'Khách Hàng',
      'Số Điện Thoại',
      'Dịch Vụ',
      'Gói',
      'Giá bán (VND)',
      'Giá vốn (VND)',
      'Tiền hoàn khách (VND)',
      'Nguồn phải hoàn dự kiến (VND)',
      'Nguồn hoàn thực tế (VND)',
      'Chênh lệch nguồn (VND)',
      'Lợi nhuận trước hoàn (VND)',
      'Lợi nhuận sau hoàn (VND)',
      'Trạng thái nguồn hoàn',
      'Đã Dùng (Ngày)',
      'Còn Lại (Ngày)',
      'Giá 1 Ngày',
      'Người Thao Tác',
      'Ghi chú lý do'
    ];

    const rows = refunds.map(rh => {
      const sourceExpected = rh.sourceRefundExpected ?? 0;
      const sourceActual = rh.sourceRefundActual ?? rh.sourceAmount ?? 0;
      const diff = sourceActual - sourceExpected;
      return [
        new Date(rh.createdAt).toLocaleDateString('vi-VN'),
        rh.order.orderCode,
        rh.order.customer.name,
        rh.order.customer.phone || '',
        rh.order.service.name,
        rh.order.packageName,
        rh.order.salePrice.toString(),
        rh.order.costPrice.toString(),
        rh.amount.toString(),
        sourceExpected.toString(),
        sourceActual.toString(),
        diff.toString(),
        (rh.order.salePrice - rh.order.costPrice).toString(),
        rh.netProfitAfterRefund.toString(),
        sourceStatusLabels[rh.sourceStatus] || rh.sourceStatus,
        rh.daysUsed.toString(),
        rh.daysRemaining.toString(),
        rh.costPerDay.toFixed(0),
        rh.operatorName || 'Hệ thống',
        rh.note || ''
      ];
    });

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `lich-su-hoan-tien-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-rose-400" />
            💸 Lịch sử hoàn tiền đơn hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">Lưu trữ các giao dịch ghi nhận hoàn tiền cho khách do tài khoản bị lỗi.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={loading || refunds.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Xuất Excel
        </button>
      </div>



      {/* Refund Dashboard Stats */}
      {refundDashboard && (
        <div className="space-y-4">
          {/* Row 1: Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/15">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">📦 Tổng đơn hoàn tiền</p>
              <p className="text-2xl font-black text-indigo-400 mt-1">{refundDashboard.totalRefundCount}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Tổng số giao dịch</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15">
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">⏳ Chờ hoàn khách</p>
              <p className="text-2xl font-black text-amber-400 mt-1">{refundDashboard.totalPendingClientCount}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Khách chưa nhận tiền</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">✅ Tổng đơn đã hoàn</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{refundDashboard.totalClientRefundedCount}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Đã hoàn tiền khách</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">🔌 Tổng đơn chờ nguồn</p>
              <p className="text-2xl font-black text-blue-400 mt-1">{refundDashboard.totalPendingSourceCount}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Chờ nguồn xử lý</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/15">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">❌ Tổng đơn bị từ chối</p>
              <p className="text-2xl font-black text-rose-400 mt-1">{refundDashboard.totalRejectedSourceCount}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Nguồn từ chối hoàn</p>
            </div>
          </div>

          {/* Row 2: Financials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/15">
              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">💸 Tổng tiền hoàn khách</p>
              <p className="text-2xl font-black text-rose-400 mt-1">{formatCurrency(refundDashboard.totalClientRefundActual)}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Thực tế đã chuyển khoản</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">🔌 Tổng tiền nguồn hoàn</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(refundDashboard.totalSourceRefundActual)}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">
                Dự kiến: {formatCurrency(refundDashboard.totalSourceRefundExpected)} | Nợ: {formatCurrency(refundDashboard.totalSourceDebt)}
              </p>
            </div>
            <div className={`p-4 rounded-2xl border ${refundDashboard.totalProfitAfterRefund >= 0 ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${refundDashboard.totalProfitAfterRefund >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>📊 Tổng lợi nhuận sau hoàn</p>
              <p className={`text-2xl font-black mt-1 ${refundDashboard.totalProfitAfterRefund >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(refundDashboard.totalProfitAfterRefund)}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">Chênh lệch: {refundDashboard.refundDiff >= 0 ? '+' : ''}{formatCurrency(refundDashboard.refundDiff)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter panel */}
      <div className="p-4 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm tên KH, SĐT, mã đơn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Service dropdown */}
          <select
            value={selectedService}
            onChange={(e) => { setSelectedService(e.target.value); setPage(1); }}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-all"
          >
            <option value="">Tất cả dịch vụ</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* TimeFilterDropdown */}
          <TimeFilterDropdown
            value={timeRange}
            onChange={(range, dates) => {
              setTimeRange(range);
              setDateRange(dates);
              if (range !== 'custom' && dates) {
                setDateStart(dates.start);
                setDateEnd(dates.end);
              } else if (range === 'all') {
                setDateStart('');
                setDateEnd('');
              }
              setPage(1);
            }}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
              setDateStart(s);
              setDateEnd(e);
              setPage(1);
            }}
          />

          {/* ColumnVisibilityToggle */}
          <div className="flex justify-end">
            <ColumnVisibilityToggle
              columns={COLUMNS_CONFIG}
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
              storageKey="admin_refunds_columns"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs text-slate-500">
          <div>
            Tổng số bản ghi: <strong className="text-slate-300 font-bold">{total}</strong>
          </div>
          <button 
            onClick={fetchRefunds}
            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới danh sách
          </button>
        </div>
      </div>

      {/* Refunds table */}
      <div className="overflow-x-auto rounded-2xl bg-[#131722]/50 border border-white/5">
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {visibleColumns.includes('createdAt') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('createdAt')}>Ngày hoàn <SortIcon col="createdAt" /></th>}
              {visibleColumns.includes('orderCode') && <th className="px-6 py-4">Mã đơn</th>}
              {visibleColumns.includes('customer') && <th className="px-6 py-4">Khách hàng</th>}
              {visibleColumns.includes('service') && <th className="px-6 py-4">Dịch vụ & Gói</th>}
              {visibleColumns.includes('financials') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('salePrice')}>Giá bán / Vốn <SortIcon col="salePrice" /></th>}
              {visibleColumns.includes('amount') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('amount')}>Hoàn khách <SortIcon col="amount" /></th>}
              {visibleColumns.includes('sourceRefund') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('sourceRefundActual')}>Nguồn hoàn <SortIcon col="sourceRefundActual" /></th>}
              {visibleColumns.includes('netProfit') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('netProfitAfterRefund')}>Lợi nhuận ròng <SortIcon col="netProfitAfterRefund" /></th>}
              {visibleColumns.includes('sourceStatus') && <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors text-right" onClick={() => handleSort('sourceStatus')}>Trạng thái nguồn <SortIcon col="sourceStatus" /></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    Đang tải dữ liệu hoàn tiền...
                  </div>
                </td>
              </tr>
            ) : refunds.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-slate-500">
                  Không tìm thấy bản ghi hoàn tiền nào
                </td>
              </tr>
            ) : (
              refunds.map((rh) => {
                const isExpanded = expandedRowId === rh.id;
                const netProfit = rh.netProfitAfterRefund || 0;
                let profitBadge = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                let profitLabel = '🟡 Hoà vốn';
                if (netProfit > 0) {
                  profitBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                  profitLabel = '🟢 Lãi';
                } else if (netProfit < 0) {
                  profitBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                  profitLabel = '🔴 Lỗ';
                }

                const sStatus = rh.sourceStatus;
                let statusBadge = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                if (sStatus === 'REQUESTED') statusBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                else if (sStatus === 'APPROVED') statusBadge = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
                else if (sStatus === 'REFUNDED') statusBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                else if (sStatus === 'REJECTED') statusBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';

                return (
                  <tr key={rh.id} className="hover:bg-white/2 transition-colors border-b border-white/5">
                    <td colSpan={visibleColumns.length} className="p-0">
                      {/* Main standard row clickable to expand */}
                      <table className="w-full text-left table-fixed">
                        <tbody>
                          <tr 
                            onClick={() => setExpandedRowId(isExpanded ? null : rh.id)}
                            className="cursor-pointer hover:bg-white/5 transition-colors"
                          >
                            {visibleColumns.includes('createdAt') && (
                              <td className="px-6 py-4 text-xs font-medium w-[10%]">
                                {new Date(rh.createdAt).toLocaleDateString('vi-VN')}
                              </td>
                            )}
                            {visibleColumns.includes('orderCode') && (
                              <td className="px-6 py-4 font-bold text-indigo-400 w-[10%]">
                                {rh.order.orderCode}
                              </td>
                            )}
                            {visibleColumns.includes('customer') && (
                              <td className="px-6 py-4 w-[15%]">
                                <div>
                                  <p className="font-bold text-white text-sm">{rh.order.customer.name}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{rh.order.customer.phone || 'Không có SĐT'}</p>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('service') && (
                              <td className="px-6 py-4 w-[18%]">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{rh.order.service.logo || '🔑'}</span>
                                  <div>
                                    <p className="font-semibold text-white truncate max-w-[130px]">{rh.order.service.name}</p>
                                    <p className="text-xs text-slate-500 truncate max-w-[130px]">{rh.order.packageName}</p>
                                  </div>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('financials') && (
                              <td className="px-6 py-4 text-xs w-[12%]">
                                <div>
                                  <p className="text-slate-300 font-medium">{formatCurrency(rh.order.salePrice)}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Vốn: {formatCurrency(rh.order.costPrice)}</p>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('amount') && (
                              <td className="px-6 py-4 w-[10%] font-mono">
                                <strong className="text-rose-400 font-semibold">{formatCurrency(rh.amount)}</strong>
                              </td>
                            )}
                            {visibleColumns.includes('sourceRefund') && (
                              <td className="px-6 py-4 w-[10%] font-mono">
                                <strong className="text-emerald-400 font-semibold">+{formatCurrency(rh.sourceRefundActual ?? rh.sourceAmount ?? 0)}</strong>
                                <p className="text-[10px] text-slate-500 mt-0.5">Dự kiến: {formatCurrency(rh.sourceRefundExpected ?? 0)}</p>
                              </td>
                            )}
                            {visibleColumns.includes('netProfit') && (
                              <td className="px-6 py-4 w-[12%] font-mono">
                                <div>
                                  <p className={`font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {netProfit > 0 ? '+' : ''}{formatCurrency(netProfit)}
                                  </p>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold mt-1 ${profitBadge}`}>
                                    {profitLabel}
                                  </span>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('sourceStatus') && (
                              <td className="px-6 py-4 w-[13%] text-right">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusBadge}`}>
                                  {sourceStatusLabels[rh.sourceStatus] || rh.sourceStatus}
                                </span>
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>

                      {/* Expanded panel details */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-4 bg-[#0f1320]/30 border-t border-white/5 font-sans">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Grid details (2/3 width) */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-300">
                              <div className="space-y-2">
                                <h4 className="font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-1">
                                  📋 THÔNG TIN ĐƠN & GIAO DỊCH
                                </h4>
                                <p>Mã đơn hàng: <strong className="text-white font-mono">{rh.order.orderCode}</strong></p>
                                <p>Khách hàng: <strong className="text-slate-100">{rh.order.customer.name}</strong> {rh.order.customer.phone && `(${rh.order.customer.phone})`}</p>
                                <p>Dịch vụ: <strong className="text-slate-100">{rh.order.service.name} - {rh.order.packageName}</strong></p>
                                <p>Nguồn nhập hàng: <strong className="text-slate-100">{rh.order.supplierSourceName || 'Nguồn trực tiếp'}</strong></p>
                                <p>Thời hạn gói: <strong className="text-slate-200">{rh.order.durationDays} ngày</strong> (Đã dùng {rh.daysUsed} ngày, còn {rh.daysRemaining} ngày)</p>
                                <p>Đơn giá 1 ngày: <strong className="text-slate-200 font-mono">{formatCurrency(rh.costPerDay)}/ngày</strong></p>
                              </div>

                              <div className="space-y-2">
                                <h4 className="font-bold text-amber-500 uppercase tracking-wider border-b border-white/5 pb-1">
                                  📅 MỐC THỜI GIAN
                                </h4>
                                <p>Ngày mua đơn: <span className="text-slate-200">{new Date(rh.order.createdAt).toLocaleDateString('vi-VN')}</span></p>
                                <p>Ngày bắt đầu: <span className="text-slate-200">{new Date(rh.order.startDate).toLocaleDateString('vi-VN')}</span></p>
                                <p>Ngày báo lỗi: <span className="text-rose-400 font-semibold">{rh.errorDate ? new Date(rh.errorDate).toLocaleDateString('vi-VN') : 'Chưa ghi nhận'}</span></p>
                                <p>Ngày hoàn tiền: <span className="text-slate-200">{new Date(rh.createdAt).toLocaleDateString('vi-VN')}</span></p>
                                <p>Ngày hết hạn gốc: <span className="text-slate-200">{new Date(rh.order.endDate).toLocaleDateString('vi-VN')}</span></p>
                              </div>

                              <div className="md:col-span-2 space-y-2 mt-2 pt-2 border-t border-white/5">
                                <h4 className="font-bold text-emerald-400 uppercase tracking-wider pb-1">
                                  💰 TÀI CHÍNH THỰC TẾ
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/2 p-3 rounded-lg border border-white/5 font-mono">
                                  <div>
                                    <p className="text-slate-500 text-[10px] uppercase font-bold font-sans">Giá bán / Giá vốn</p>
                                    <p className="text-white font-semibold">{formatCurrency(rh.order.salePrice)} / {formatCurrency(rh.order.costPrice)}</p>
                                  </div>
                                  <div>
                                    <p className="text-rose-400 text-[10px] uppercase font-bold font-sans">Đã hoàn khách</p>
                                    <p className="text-rose-400 font-semibold">{formatCurrency(rh.amount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-indigo-400 text-[10px] uppercase font-bold font-sans">Nguồn phải hoàn (dự kiến)</p>
                                    <p className="text-indigo-400 font-semibold">{formatCurrency(rh.sourceRefundExpected ?? 0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-emerald-400 text-[10px] uppercase font-bold font-sans">Nguồn hoàn thực tế</p>
                                    <p className="text-emerald-400 font-semibold">+{formatCurrency(rh.sourceRefundActual ?? rh.sourceAmount ?? 0)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px] uppercase font-bold font-sans">Chênh lệch nguồn</p>
                                    <p className={`font-semibold ${((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected ?? 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected ?? 0)) >= 0 ? '+' : ''}
                                      {formatCurrency((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected ?? 0))}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 text-[10px] uppercase font-bold font-sans">Lợi nhuận ban đầu</p>
                                    <p className="text-white font-semibold">+{formatCurrency(rh.order.salePrice - rh.order.costPrice)}</p>
                                  </div>
                                  <div className="col-span-2">
                                    <p className="text-slate-300 text-[10px] uppercase font-bold font-sans">Lợi nhuận thực tế sau hoàn</p>
                                    <p className={`font-black text-sm ${rh.netProfitAfterRefund >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {formatCurrency(rh.netProfitAfterRefund || 0)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Edit Form / Operations (1/3 width) */}
                            <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs space-y-3 font-sans">
                              <h4 className="font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-1 flex items-center justify-between">
                                <span>⚙️ QUẢN LÝ NGUỒN HOÀN TIỀN</span>
                                {editingRefundId !== rh.id && (
                                  <button
                                    onClick={() => startEditing(rh)}
                                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] cursor-pointer"
                                  >
                                    ✏️ Chỉnh sửa
                                  </button>
                                )}
                              </h4>

                              {editingRefundId === rh.id ? (
                                <div className="space-y-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-slate-400 text-[10px] uppercase font-bold">Nguồn hoàn thực tế (VND)</label>
                                    <input
                                      type="number"
                                      value={editSourceAmount}
                                      onChange={(e) => setEditSourceAmount(parseFloat(e.target.value) || 0)}
                                      className="px-2.5 py-1.5 rounded bg-[#131722] border border-white/10 text-white focus:border-indigo-500 outline-none text-xs w-full font-mono font-bold"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      Nguồn dự kiến hoàn: <span className="font-bold">{formatCurrency(rh.sourceRefundExpected ?? 0)}</span>
                                    </p>
                                    {editSourceAmount !== (rh.sourceRefundExpected ?? 0) && (
                                      <p className={`text-[10px] font-bold mt-0.5 ${editSourceAmount > (rh.sourceRefundExpected ?? 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        Chênh lệch: {editSourceAmount > (rh.sourceRefundExpected ?? 0) ? '+' : ''}{formatCurrency(editSourceAmount - (rh.sourceRefundExpected ?? 0))}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-slate-400 text-[10px] uppercase font-bold">Trạng thái nguồn</label>
                                    <select
                                      value={editSourceStatus}
                                      onChange={(e) => setEditSourceStatus(e.target.value)}
                                      className="px-2 py-1.5 rounded bg-[#131722] border border-white/10 text-white focus:border-indigo-500 outline-none text-xs w-full"
                                    >
                                      <option value="NOT_REQUESTED">Chưa yêu cầu</option>
                                      <option value="REQUESTED">Đã yêu cầu</option>
                                      <option value="REFUNDED">Đã hoàn tiền</option>
                                      <option value="REJECTED">Từ chối</option>
                                    </select>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <label className="text-slate-400 text-[10px] uppercase font-bold">Ghi chú nguồn / Lý do</label>
                                    <textarea
                                      rows={2}
                                      value={editNote}
                                      onChange={(e) => setEditNote(e.target.value)}
                                      className="px-2.5 py-1.5 rounded bg-[#131722] border border-white/10 text-white focus:border-indigo-500 outline-none text-xs w-full resize-none"
                                      placeholder="Nhập lý do lỗi, thông tin liên hệ nguồn..."
                                    />
                                  </div>

                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => handleUpdateRefund(rh.id)}
                                      disabled={savingRefundId === rh.id}
                                      className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold rounded text-[11px] cursor-pointer flex items-center justify-center gap-1"
                                    >
                                      {savingRefundId === rh.id ? (
                                        <>
                                          <Loader2 className="w-3 animate-spin" />
                                          Đang lưu...
                                        </>
                                      ) : (
                                        '💾 Lưu'
                                      )}
                                    </button>
                                    <button
                                      onClick={() => setEditingRefundId(null)}
                                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded text-[11px] cursor-pointer"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2 text-slate-300 font-mono">
                                  <p className="font-sans">Phải hoàn dự kiến: <strong className="text-slate-300">{formatCurrency(rh.sourceRefundExpected || 0)}</strong></p>
                                  <p className="font-sans">Thực tế hoàn lại: <strong className="text-emerald-400">+{formatCurrency(rh.sourceRefundActual ?? rh.sourceAmount ?? 0)}</strong></p>
                                  <p className="font-sans">Chênh lệch nguồn: 
                                    <strong className={`ml-1 ${((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected || 0)) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected || 0)) >= 0 ? '+' : ''}
                                      {formatCurrency((rh.sourceRefundActual ?? rh.sourceAmount ?? 0) - (rh.sourceRefundExpected || 0))}
                                    </strong>
                                  </p>
                                  <p className="font-sans">Trạng thái nguồn: 
                                    <span className="ml-1 font-semibold text-slate-200 font-sans">
                                      {sourceStatusLabels[rh.sourceStatus] || rh.sourceStatus}
                                    </span>
                                  </p>
                                  <p className="font-sans">Lợi nhuận sau hoàn: 
                                    <strong className={`ml-1 ${rh.netProfitAfterRefund >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      {formatCurrency(rh.netProfitAfterRefund || 0)}
                                    </strong>
                                  </p>
                                  <p className="text-slate-400 italic text-[11px] mt-1.5 border-t border-white/3 pt-1.5 font-sans">
                                    Ghi chú: {rh.note || 'Không có ghi chú'}
                                  </p>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Trang trước
          </button>
          <span className="text-xs text-slate-400">
            Trang <strong className="text-white">{page}</strong> / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
          >
            Trang sau
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
