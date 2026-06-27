'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ShieldAlert, Search, ChevronDown, ChevronUp, Loader2, Download,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Filter, X, Lock, Unlock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateShort, getSourceRefundLabel } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import CountdownBadge from '@/components/shared/CountdownBadge';
import TimeFilterDropdown, { TimeRange, DateRange } from '@/components/shared/TimeFilterDropdown';
import StatusChangePopup, { StatusOption } from '@/components/shared/StatusChangePopup';
import ColumnVisibilityToggle from '@/components/shared/ColumnVisibilityToggle';
import { saveColumnVisibility, loadColumnVisibility, filterByTimeRange } from '@/lib/tableUtils';
import StickyBottomActionBar from '@/components/shared/StickyBottomActionBar';

type SortDir = 'asc' | 'desc' | null;

interface CustomerLifetimeStat {
  totalOrders: number;
  totalSpend: number;
  lastOrderDate: string | null;
  totalRefundAmount: number;
}

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
  customerLifetimeStats: Record<string, CustomerLifetimeStat>;
}

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
  if (sortDir === 'asc') return <ArrowUp className="w-3 h-3 text-indigo-400" />;
  if (sortDir === 'desc') return <ArrowDown className="w-3 h-3 text-indigo-400" />;
  return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
}

export default function WarrantyList({
  initialOrders,
  supplierSources,
  services,
  stats: initialStats,
  customerLifetimeStats,
}: WarrantyListProps) {
  const router = useRouter();
  const { data: session } = useSession();
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

  // Order unlock states
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockOrder, setUnlockOrder] = useState<any | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const handleBadgeClick = (order: any) => {
    const isLocked = ['WARRANTY_DONE', 'REFUNDED'].includes(order.status) && !order.isUnlocked;
    if (isLocked) {
      if (session?.user?.role === 'ADMIN') {
        if (confirm('Đơn hàng này đang bị khóa. Bạn có muốn mở khóa đơn hàng để chỉnh sửa không?')) {
          setUnlockOrder(order);
          setUnlockReason('');
          setUnlockModalOpen(true);
        }
      } else {
        toast.error('Đơn hàng đã khóa. Chỉ Admin mới có quyền mở khóa đơn.');
      }
    } else {
      setStatusPopupOrder(order);
      setStatusPopupOpen(true);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockOrder || !unlockReason.trim()) return;
    const loadingToast = toast.loading('Đang mở khóa đơn hàng...');
    try {
      const res = await fetch(`/api/admin/orders/${unlockOrder.id}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: unlockReason }),
      });
      if (res.ok) {
        toast.success('Mở khóa đơn hàng thành công!', { id: loadingToast });
        setOrders(prev => prev.map(o => o.id === unlockOrder.id ? { ...o, isUnlocked: true, unlockReason } : o));
        setUnlockModalOpen(false);
        setUnlockOrder(null);
        setUnlockReason('');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Mở khóa thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ', { id: loadingToast });
    }
  };

  // Time Filter States
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Column Visibility States
  const COLUMNS_CONFIG = [
    { id: 'orderCode', label: 'Mã đơn' },
    { id: 'service', label: 'Dịch vụ' },
    { id: 'source', label: 'Nguồn hàng' },
    { id: 'remaining', label: 'Thời hạn còn lại' },
    { id: 'dates', label: 'Mốc thời gian' },
    { id: 'createdAt', label: 'Ngày tạo' },
    { id: 'updatedAt', label: 'Ngày cập nhật' },
    { id: 'errorDate', label: 'Ngày báo lỗi' },
    { id: 'sourceReplyDate', label: 'Ngày nguồn phản hồi' },
    { id: 'refundDate', label: 'Ngày hoàn tiền' },
    { id: 'completedDate', label: 'Ngày hoàn tất' },
    { id: 'paidDate', label: 'Ngày thanh toán' },
    { id: 'refund', label: 'Hoàn khách' },
    { id: 'sourceRefund', label: 'Nguồn hoàn' },
    { id: 'status', label: 'Trạng thái' },
    { id: 'profit', label: 'Lợi nhuận' },
  ];
  const DEFAULT_COLUMNS = ['orderCode', 'service', 'source', 'remaining', 'dates', 'refund', 'sourceRefund', 'status', 'profit'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadColumnVisibility('admin_warranties_columns');
    setVisibleColumns(saved.length > 0 ? saved : DEFAULT_COLUMNS);
  }, []);

  const handleToggleColumn = (colId: string) => {
    const next = visibleColumns.includes(colId)
      ? visibleColumns.filter(id => id !== colId)
      : [...visibleColumns, colId];
    setVisibleColumns(next);
    saveColumnVisibility('admin_warranties_columns', next);
  };

  // Status Change Popup States
  const [statusPopupOpen, setStatusPopupOpen] = useState(false);
  const [statusPopupOrder, setStatusPopupOrder] = useState<any | null>(null);

  const handleStatusChangeSubmit = async (data: {
    status: string;
    note: string;
    notifyCustomer: boolean;
    saveHistory: boolean;
  }) => {
    if (!statusPopupOrder) return;
    const loadingToast = toast.loading('Đang cập nhật trạng thái đơn hàng...');
    try {
      const res = await fetch(`/api/admin/orders/${statusPopupOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: data.status,
          note: data.note ? `${statusPopupOrder.note || ''}\n[Cập nhật trạng thái]: ${data.note}`.trim() : undefined,
          notifyCustomer: data.notifyCustomer,
          saveHistory: data.saveHistory,
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật trạng thái thành công!', { id: loadingToast });
        setOrders(prev => prev.map(o => o.id === statusPopupOrder.id ? { ...o, status: data.status, isUnlocked: false } : o));
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ', { id: loadingToast });
    }
  };

  // Sort state for customer groups
  const [sortCol, setSortCol] = useState<string>('errorDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir(null);
      setSortCol('errorDate');
      setSortDir('desc');
    }
  };

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
    let filtered = orders;
    if (timeRange !== 'all') {
      let start: Date | null = null;
      let end: Date | null = null;
      if (timeRange === 'custom') {
        if (customStart) start = new Date(customStart);
        if (customEnd) {
          end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
        }
      } else if (dateRange) {
        start = new Date(dateRange.start);
        end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
      }
      filtered = filterByTimeRange(filtered, start, end);
    }

    return filtered.filter(o => {
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
  }, [orders, search, statusFilter, sourceFilter, serviceFilter, timeRange, customStart, customEnd, dateRange]);

  // Group by customer
  const groupedByCustomer = useMemo(() => {
    const map = new Map<string, {
      customer: any;
      orders: any[];
      totalRefund: number;
      totalSourceRefund: number;
      totalProfit: number;
      lastErrorDate: Date | null;
    }>();

    for (const order of filteredOrders) {
      const cId = order.customerId;
      if (!map.has(cId)) {
        map.set(cId, {
          customer: order.customer,
          orders: [],
          totalRefund: 0,
          totalSourceRefund: 0,
          totalProfit: 0,
          lastErrorDate: null,
        });
      }
      const entry = map.get(cId)!;
      entry.orders.push(order);

      const refundTotal = order.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
      const sourceTotal = order.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0;
      entry.totalRefund += refundTotal;
      entry.totalSourceRefund += sourceTotal;
      entry.totalProfit += (order.salePrice - order.costPrice - refundTotal + sourceTotal);

      // Track latest error date (updatedAt of latest order in group)
      const orderDate = new Date(order.updatedAt);
      if (!entry.lastErrorDate || orderDate > entry.lastErrorDate) {
        entry.lastErrorDate = orderDate;
      }
    }

    let groups = Array.from(map.entries());

    // Sort groups
    groups.sort((a, b) => {
      const [, ga] = a;
      const [, gb] = b;
      let valA: number;
      let valB: number;

      switch (sortCol) {
        case 'totalRefund':
          valA = ga.totalRefund;
          valB = gb.totalRefund;
          break;
        case 'totalSourceRefund':
          valA = ga.totalSourceRefund;
          valB = gb.totalSourceRefund;
          break;
        case 'totalProfit':
          valA = ga.totalProfit;
          valB = gb.totalProfit;
          break;
        case 'errorDate':
        default:
          valA = ga.lastErrorDate?.getTime() || 0;
          valB = gb.lastErrorDate?.getTime() || 0;
          break;
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return groups.slice(0, pageSize);
  }, [filteredOrders, pageSize, sortCol, sortDir]);

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

  const executeBulkActionDirect = async (action: string, note: string, sourceId?: string) => {
    let confirmMsg = '';
    const numOrders = selectedIds.size;
    if (action === 'report_error') {
      confirmMsg = `Xác nhận BÁO LỖI hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'pending_source') {
      confirmMsg = `Xác nhận chuyển trạng thái thành CHỜ HOÀN NGUỒN hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'pending_refund') {
      confirmMsg = `Xác nhận chuyển trạng thái thành CHỜ HOÀN TIỀN KHÁCH hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'done') {
      confirmMsg = `Xác nhận chuyển trạng thái thành ĐÃ HOÀN TIỀN KHÁCH hàng loạt cho ${numOrders} đơn hàng? Hành động này sẽ khóa các đơn hàng này!`;
    } else if (action === 'rejected') {
      confirmMsg = `Xác nhận TỪ CHỐI bảo hành hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'change_source') {
      confirmMsg = `Xác nhận THAY ĐỔI NGUỒN hàng loạt cho ${numOrders} đơn hàng?`;
    } else {
      confirmMsg = `Xác nhận thực hiện thao tác hàng loạt cho ${numOrders} đơn hàng đã chọn?`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

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
          action: actionMap[action] || action,
          payload: {
            note,
            supplierSourceId: sourceId || undefined,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const { success, failed, errors } = data;
        if (action === 'change_source' && sourceId) {
          const newSource = supplierSources.find(s => s.id === sourceId);
          setOrders(prev => prev.map(o =>
            selectedArray.includes(o.id)
              ? { ...o, supplierSourceId: sourceId, supplierSourceName: newSource?.name || o.supplierSourceName }
              : o
          ));
        } else if (statusMap[action]) {
          const newStatus = statusMap[action];
          const errorSet = new Set(errors?.map((e: any) => e.orderId) || []);
          setOrders(prev => prev.map(o =>
            selectedArray.includes(o.id) && !errorSet.has(o.id)
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
        setBulkSourceId('');
        router.refresh();
      } else {
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAction = useCallback(async () => {
    if (!bulkAction || selectedIds.size === 0) return;
    executeBulkActionDirect(bulkAction, bulkNote, bulkSourceId);
  }, [bulkAction, selectedIds, bulkNote, bulkSourceId, supplierSources]);

  // Batch Refund Previews
  const [batchRefundModalOpen, setBatchRefundModalOpen] = useState(false);
  const [batchRefundErrorDate, setBatchRefundErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchRefundReason, setBatchRefundReason] = useState('Hoàn tiền hàng loạt');

  const batchRefundPreviews = useMemo(() => {
    if (selectedIds.size === 0) return { list: [], totalClientRefund: 0, totalSourceRefund: 0, totalProfitAfter: 0 };
    const selectedOrders = orders.filter(o => selectedIds.has(o.id));
    const faultDate = new Date(batchRefundErrorDate);

    let totalClientRefund = 0;
    let totalSourceRefund = 0;
    let totalProfitAfter = 0;

    const list = selectedOrders.map(o => {
      const start = new Date(o.startDate);
      const durationDays = o.durationDays || 30;
      const diffTime = faultDate.getTime() - start.getTime();
      let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
      daysUsed = Math.min(durationDays, Math.max(0, daysUsed));
      const daysRemaining = Math.max(0, durationDays - daysUsed);

      const clientRefund = Math.round(daysRemaining * (o.salePrice / durationDays));
      const sourceRefund = Math.round(daysRemaining * (o.costPrice / durationDays));
      const profitAfter = o.salePrice - o.costPrice - clientRefund + sourceRefund;

      totalClientRefund += clientRefund;
      totalSourceRefund += sourceRefund;
      totalProfitAfter += profitAfter;

      return {
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customer?.name || 'N/A',
        salePrice: o.salePrice,
        costPrice: o.costPrice,
        clientRefund,
        sourceRefund,
        profitAfter,
      };
    });

    return {
      list,
      totalClientRefund,
      totalSourceRefund,
      totalProfitAfter,
    };
  }, [selectedIds, orders, batchRefundErrorDate]);

  const handleBatchRefundSubmit = async () => {
    setBulkLoading(true);
    const selectedArray = Array.from(selectedIds);
    try {
      const res = await fetch('/api/admin/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedArray,
          action: 'BATCH_REFUND',
          payload: {
            errorDate: batchRefundErrorDate,
            reason: batchRefundReason,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Hoàn tiền hàng loạt hoàn tất!');
        setOrders(prev => prev.map(o =>
          selectedArray.includes(o.id)
            ? { ...o, status: 'REFUNDED' }
            : o
        ));
        setSelectedIds(new Set());
        setBatchRefundModalOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setBulkLoading(false);
    }
  };

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
    link.download = `xu-ly-sau-ban-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast.success(`Đã xuất ${filteredOrders.length} đơn`);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSourceFilter('');
    setServiceFilter('');
  };

  const hasActiveFilters = search || statusFilter || sourceFilter || serviceFilter;

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-blue-400" />
            🛡️ Xử lý sau bán
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Theo dõi đơn lỗi, xử lý hoàn tiền. Quy trình: Báo lỗi → Chờ nguồn → Chờ hoàn khách → Hoàn tất
          </p>
        </div>
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer self-start">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Tổng đơn lỗi', value: stats.total, color: 'text-white', filter: '' },
          { label: 'Khách báo lỗi', value: stats.warranty, color: 'text-blue-400', filter: 'WARRANTY' },
          { label: 'Chờ nguồn', value: stats.pendingSource, color: 'text-purple-400', filter: 'WARRANTY_PENDING_SOURCE' },
          { label: 'Chờ hoàn khách', value: stats.pendingRefund, color: 'text-orange-400', filter: 'WARRANTY_PENDING_REFUND' },
          { label: 'Hoàn tất', value: stats.done, color: 'text-emerald-400', filter: 'WARRANTY_DONE' },
          { label: 'Từ chối', value: stats.rejected, color: 'text-red-400', filter: 'WARRANTY_REJECTED' },
          { label: 'Hoàn khách', value: formatCurrency(stats.totalRefundAmount), color: 'text-rose-400', isText: true, filter: '' },
          { label: 'Nguồn hoàn', value: formatCurrency(stats.totalSourceRefund), color: 'text-emerald-400', isText: true, filter: '' },
        ].map((s, i) => (
          <button
            key={i}
            onClick={() => s.filter ? setStatusFilter(statusFilter === s.filter ? '' : s.filter) : null}
            className={`p-3 rounded-xl border text-left transition-all ${
              s.filter && statusFilter === s.filter
                ? 'bg-indigo-500/20 border-indigo-500/40'
                : 'bg-white/5 border-white/5 hover:bg-white/8'
            } ${s.filter ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-lg font-bold mt-1 ${s.color}`}>{(s as any).isText ? s.value : `${s.value} đơn`}</p>
          </button>
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
            <option value="REPORTED">🔵 Khách báo lỗi</option>
            <option value="WAIT_SOURCE">🟣 Chờ nguồn hoàn</option>
            <option value="WAIT_CUSTOMER_REFUND">🟠 Chờ hoàn khách</option>
            <option value="COMPLETED">✅ Hoàn tất</option>
            <option value="SOURCE_REJECTED">⛔ Từ chối</option>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <TimeFilterDropdown
            value={timeRange}
            onChange={(range, dates) => {
              setTimeRange(range);
              setDateRange(dates);
            }}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
          <div className="flex justify-end">
            <ColumnVisibilityToggle
              columns={COLUMNS_CONFIG}
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
              storageKey="admin_warranties_columns"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
          <div className="flex items-center gap-3">
            <span>Tổng: <strong className="text-white">{filteredOrders.length}</strong> đơn · <strong className="text-white">{groupedByCustomer.length}</strong> khách</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold cursor-pointer border border-red-500/20">
                <X className="w-3 h-3" /> Xóa bộ lọc
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Hiển thị:</span>
            {[10, 50, 100, 300].map(n => (
              <button key={n} onClick={() => setPageSize(n)} className={`px-2 py-0.5 rounded text-[10px] border cursor-pointer ${pageSize === n ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <StickyBottomActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        actions={[
          {
            label: 'Báo lỗi',
            onClick: () => {
              const note = prompt('Nhập lý do báo lỗi (tùy chọn):');
              if (note !== null) executeBulkActionDirect('report_error', note);
            },
            variant: 'danger' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Chờ nguồn hoàn',
            onClick: () => {
              const note = prompt('Nhập ghi chú chờ nguồn hoàn (tùy chọn):');
              if (note !== null) executeBulkActionDirect('pending_source', note);
            },
            variant: 'purple' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Chờ hoàn khách',
            onClick: () => {
              const note = prompt('Nhập ghi chú chờ hoàn khách (tùy chọn):');
              if (note !== null) executeBulkActionDirect('pending_refund', note);
            },
            variant: 'warning' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Hoàn khách (Hoàn tất)',
            onClick: () => {
              const note = prompt('Nhập ghi chú hoàn tất (tùy chọn):');
              if (note !== null) executeBulkActionDirect('done', note);
            },
            variant: 'success' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Từ chối bảo hành',
            onClick: () => {
              const note = prompt('Nhập ghi chú từ chối (tùy chọn):');
              if (note !== null) executeBulkActionDirect('rejected', note);
            },
            variant: 'secondary' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Hoàn tiền hàng loạt',
            onClick: () => setBatchRefundModalOpen(true),
            variant: 'danger' as const,
            disabled: bulkLoading,
          },
          {
            label: 'Đổi nguồn hàng',
            onClick: () => {
              const srcNames = supplierSources.map((s, idx) => `${idx + 1}. ${s.name}`).join('\n');
              const choice = prompt(`Chọn nguồn hàng mới (nhập số từ 1 đến ${supplierSources.length}):\n${srcNames}`);
              if (choice) {
                const idx = parseInt(choice) - 1;
                const selectedSource = supplierSources[idx];
                if (selectedSource) {
                  const note = prompt('Nhập ghi chú đổi nguồn (tùy chọn):');
                  if (note !== null) executeBulkActionDirect('change_source', note, selectedSource.id);
                } else {
                  alert('Lựa chọn không hợp lệ.');
                }
              }
            },
            variant: 'primary' as const,
            disabled: bulkLoading,
          }
        ]}
      />

      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
        <Filter className="w-3.5 h-3.5" />
        <span className="font-medium">Sắp xếp nhóm:</span>
        {[
          { col: 'errorDate', label: 'Ngày lỗi gần nhất' },
          { col: 'totalRefund', label: 'Hoàn khách' },
          { col: 'totalSourceRefund', label: 'Nguồn hoàn' },
          { col: 'totalProfit', label: 'Lợi nhuận' },
        ].map(s => (
          <button
            key={s.col}
            onClick={() => handleSort(s.col)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              sortCol === s.col
                ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {s.label}
            <SortIcon col={s.col} sortCol={sortCol} sortDir={sortDir} />
          </button>
        ))}
      </div>

      {/* Grouped warranty list */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-2">
          <input type="checkbox" checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
            onChange={selectAll} className="w-4 h-4 rounded border-white/20 accent-indigo-500 cursor-pointer" />
          <span className="text-xs text-slate-400">Chọn tất cả</span>
        </div>

        {groupedByCustomer.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/[0.02] border border-white/5 rounded-2xl text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Không tìm thấy đơn lỗi nào</p>
              <p className="text-xs text-slate-500 mt-1">Hệ thống hiện tại không có yêu cầu bảo hành hoặc lọc trùng khớp.</p>
            </div>
          </div>
        )}

        {groupedByCustomer.map(([customerId, group]) => {
          const isExpanded = expandedCustomers.has(customerId);
          const profitColor = group.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400';
          const lifetimeStat = customerLifetimeStats[customerId];

          // Count orders by status in this group
          const activeWarrantyCount = group.orders.filter((o: any) =>
            ['REPORTED', 'WAIT_SOURCE', 'WAIT_CUSTOMER_REFUND'].includes(o.status)
          ).length;
          const resolvedCount = group.orders.filter((o: any) =>
            ['COMPLETED', 'SOURCE_REJECTED'].includes(o.status)
          ).length;

          return (
            <div key={customerId} className="rounded-2xl bg-[#131722]/50 border border-white/5 overflow-hidden hover:border-white/10 transition-all">
              {/* Customer Group Header */}
              <button onClick={() => toggleCustomer(customerId)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-all cursor-pointer text-left">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {group.customer?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Link
                        href={`/admin/customers/${customerId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        {group.customer?.name}
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      </Link>
                    </h3>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-slate-500">{group.customer?.phone || 'Không có SĐT'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                        {group.orders.length} đơn lỗi
                      </span>
                      {activeWarrantyCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20">
                          {activeWarrantyCount} đang xử lý
                        </span>
                      )}
                      {resolvedCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          {resolvedCount} đã xong
                        </span>
                      )}
                      {lifetimeStat && (
                        <span className="text-[10.5px] px-2 py-0.5 rounded bg-[#1a1f2e] text-slate-300 border border-white/5 flex items-center gap-1 font-semibold">
                          💎 Lifetime: <strong>{lifetimeStat.totalOrders} đơn</strong> | <strong>{formatCurrency(lifetimeStat.totalSpend)}</strong>
                        </span>
                      )}
                      {group.lastErrorDate && (
                        <span className="text-[10.5px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20 flex items-center gap-1">
                          🚨 Lỗi gần nhất: {group.lastErrorDate.toLocaleDateString('vi-VN')} {group.lastErrorDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Hoàn khách</p>
                    <p className="text-rose-400 font-bold">{formatCurrency(group.totalRefund)}</p>
                  </div>
                  <div className="text-right hidden sm:block">
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

              {/* Orders inside group */}
              {isExpanded && (
                <div className="border-t border-white/5 p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-2 w-12 text-center">STT</th>
                        <th className="px-4 py-2 w-12 text-center">
                          <input type="checkbox" checked={group.orders.every(o => selectedIds.has(o.id))}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              group.orders.forEach(o => {
                                if (e.target.checked) next.add(o.id);
                                else next.delete(o.id);
                              });
                              setSelectedIds(next);
                            }}
                            className="w-4 h-4 rounded border-white/20 accent-indigo-500 cursor-pointer" />
                        </th>
                        {visibleColumns.includes('orderCode') && <th className="px-4 py-2 min-w-[100px]">Mã đơn</th>}
                        {visibleColumns.includes('service') && <th className="px-4 py-2 min-w-[120px]">Dịch vụ</th>}
                        {visibleColumns.includes('source') && <th className="px-4 py-2 min-w-[110px]">Nguồn hàng</th>}
                        {visibleColumns.includes('remaining') && <th className="px-4 py-2 min-w-[130px]">Thời hạn còn lại</th>}
                        {visibleColumns.includes('dates') && <th className="px-4 py-2 min-w-[180px]">Mốc thời gian</th>}
                        {visibleColumns.includes('createdAt') && <th className="px-4 py-2 text-center min-w-[90px]">Ngày tạo</th>}
                        {visibleColumns.includes('updatedAt') && <th className="px-4 py-2 text-center min-w-[90px]">Ngày cập nhật</th>}
                        {visibleColumns.includes('errorDate') && <th className="px-4 py-2 text-center min-w-[95px]">Ngày báo lỗi</th>}
                        {visibleColumns.includes('sourceReplyDate') && <th className="px-4 py-2 text-center min-w-[95px]">Ngày nguồn phản hồi</th>}
                        {visibleColumns.includes('refundDate') && <th className="px-4 py-2 text-center min-w-[95px]">Ngày hoàn tiền</th>}
                        {visibleColumns.includes('completedDate') && <th className="px-4 py-2 text-center min-w-[95px]">Ngày hoàn tất</th>}
                        {visibleColumns.includes('paidDate') && <th className="px-4 py-2 text-center min-w-[95px]">Ngày thanh toán</th>}
                        {visibleColumns.includes('refund') && <th className="px-4 py-2 text-right min-w-[130px]">Hoàn khách</th>}
                        {visibleColumns.includes('sourceRefund') && <th className="px-4 py-2 text-right min-w-[130px]">Nguồn hoàn</th>}
                        {visibleColumns.includes('status') && <th className="px-4 py-2 text-right min-w-[120px]">Trạng thái</th>}
                        {visibleColumns.includes('profit') && <th className="px-4 py-2 text-right min-w-[110px]">Lợi nhuận</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03] text-slate-300">
                      {group.orders.map((order: any, orderIdx: number) => {
                        const latestRefund = order.refundHistories?.sort((a: any, b: any) =>
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
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

                        const expectedRefund = latestRefund
                          ? (latestRefund.autoRefundAmount || latestRefund.amount)
                          : Math.round(daysRemaining * (order.salePrice / durationDays));
                        const actualRefund = order.refundHistories?.reduce((s: number, r: any) => s + r.amount, 0) || 0;
                        const expectedSourceRefund = latestRefund
                          ? latestRefund.sourceRefundExpected
                          : Math.round(daysRemaining * (order.costPrice / durationDays));
                        const actualSourceRefund = order.refundHistories?.reduce((s: number, r: any) => s + (r.sourceRefundActual || 0), 0) || 0;
                        const profit = order.salePrice - order.costPrice - actualRefund + actualSourceRefund;

                        const statusColor = ORDER_STATUS_COLORS[order.status] || '';
                        const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;

                        return (
                          <tr key={order.id} className="hover:bg-white/[0.02] transition-all">
                            <td className="px-4 py-1.5 text-center text-slate-500 font-mono text-xs">{orderIdx + 1}</td>
                            <td className="px-4 py-1.5 w-10 text-center">
                              <input type="checkbox" checked={selectedIds.has(order.id)} onChange={() => toggleSelect(order.id)}
                                className="w-4 h-4 rounded border-white/20 accent-indigo-500 cursor-pointer" />
                            </td>
                            {visibleColumns.includes('orderCode') && (
                              <td className="px-4 py-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Link href={`/admin/orders/${order.id}`} className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                                    {order.orderCode}
                                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                                  </Link>
                                  {['COMPLETED', 'SOURCE_REJECTED'].includes(order.status) && (
                                    order.isUnlocked ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold cursor-help bg-emerald-500/10 border border-emerald-500/20 px-1 rounded" title={`Đơn đã mở khóa. Lý do: ${order.unlockReason}`}>
                                        <Unlock className="w-2.5 h-2.5" /> Mở
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] text-rose-400 font-bold cursor-help bg-rose-500/10 border border-rose-500/20 px-1 rounded" title="Đơn đã khóa. Click vào trạng thái để mở khóa.">
                                        <Lock className="w-2.5 h-2.5" /> Khóa
                                      </span>
                                    )
                                  )}
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('service') && (
                              <td className="px-4 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base">{order.service?.logo || '🔑'}</span>
                                  <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setServiceFilter(order.serviceId); }}
                                    className="text-slate-300 truncate font-semibold hover:text-indigo-400 hover:underline cursor-pointer focus:outline-none"
                                  >
                                    {order.service?.name}
                                  </button>
                                </div>
                              </td>
                            )}
                            {visibleColumns.includes('source') && (
                              <td className="px-4 py-1.5 text-slate-400">
                                {order.supplierSourceId ? (
                                  <Link href={`/admin/sources/${order.supplierSourceId}`} className="hover:text-slate-300 transition-colors font-medium">
                                    {order.supplierSourceName || 'N/A'}
                                  </Link>
                                ) : (order.supplierSourceName || 'Trực tiếp')}
                              </td>
                            )}
                            {visibleColumns.includes('remaining') && (
                              <td className="px-4 py-1.5">
                                <button
                                  onClick={() => handleBadgeClick(order)}
                                  className="hover:opacity-85 transition-all text-left focus:outline-none cursor-pointer"
                                  title="Nhấp để thay đổi trạng thái đơn hàng"
                                >
                                  {(() => {
                                    const errorDateVal = latestRefund ? (latestRefund.errorDate || latestRefund.createdAt) : order.updatedAt;
                                    return (
                                      <CountdownBadge endDate={order.endDate} status={order.status} completedAt={errorDateVal} />
                                    );
                                  })()}
                                </button>
                              </td>
                            )}
                            {visibleColumns.includes('dates') && (
                              <td className="px-4 py-1.5 text-[10px] text-slate-500 font-mono">
                                <p>Đã dùng: <strong className="text-amber-400 font-mono">{daysUsed}</strong> / {durationDays} ngày</p>
                                <p className="mt-0.5">KH: {formatDateShort(order.startDate)} · Hạn: {formatDateShort(order.endDate)}</p>
                              </td>
                            )}
                            {visibleColumns.includes('createdAt') && (
                              <td className="px-4 py-1.5 text-slate-400 font-mono text-center">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                            )}
                            {visibleColumns.includes('updatedAt') && (
                              <td className="px-4 py-1.5 text-slate-400 font-mono text-center">{order.updatedAt ? new Date(order.updatedAt).toLocaleDateString('vi-VN') : '—'}</td>
                            )}
                            {visibleColumns.includes('errorDate') && (
                              <td className="px-4 py-1.5 text-rose-400 font-mono text-center">{latestRefund?.errorDate ? new Date(latestRefund.errorDate).toLocaleDateString('vi-VN') : '—'}</td>
                            )}
                            {visibleColumns.includes('sourceReplyDate') && (
                              <td className="px-4 py-1.5 text-slate-400 font-mono text-center">
                                {latestRefund && latestRefund.sourceStatus !== 'PENDING' && latestRefund.updatedAt
                                  ? new Date(latestRefund.updatedAt).toLocaleDateString('vi-VN')
                                  : '—'}
                              </td>
                            )}
                            {visibleColumns.includes('refundDate') && (
                              <td className="px-4 py-1.5 text-emerald-400 font-mono text-center">{latestRefund?.createdAt ? new Date(latestRefund.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                            )}
                            {visibleColumns.includes('completedDate') && (
                              <td className="px-4 py-1.5 text-slate-400 font-mono text-center">
                                {order.status === 'COMPLETED' && order.updatedAt
                                  ? new Date(order.updatedAt).toLocaleDateString('vi-VN')
                                  : '—'}
                              </td>
                            )}
                            {visibleColumns.includes('paidDate') && (
                              <td className="px-4 py-1.5 text-slate-400 font-mono text-center">{order.paidAt ? new Date(order.paidAt).toLocaleDateString('vi-VN') : '—'}</td>
                            )}
                            {visibleColumns.includes('refund') && (
                              <td className="px-4 py-1.5 text-right font-mono">
                                <div className="text-[10px] text-slate-500">Dự kiến: {formatCurrency(expectedRefund)}</div>
                                <div className="text-rose-400 font-bold">Thực tế: {formatCurrency(actualRefund)}</div>
                              </td>
                            )}
                            {visibleColumns.includes('sourceRefund') && (
                              <td className="px-4 py-1.5 text-right font-mono">
                                <div className="text-[10px] text-slate-500">Dự kiến: {formatCurrency(expectedSourceRefund)}</div>
                                <div className="text-emerald-400 font-bold">Thực tế: +{formatCurrency(actualSourceRefund)}</div>
                              </td>
                            )}
                            {visibleColumns.includes('status') && (
                              <td className="px-4 py-1.5 text-right">
                                <button
                                  onClick={() => handleBadgeClick(order)}
                                  className="hover:opacity-85 transition-all text-left focus:outline-none cursor-pointer flex flex-col items-end"
                                  title="Nhấp để thay đổi trạng thái đơn hàng"
                                >
                                  <span className={`status-badge border ${statusColor}`}>{statusLabel}</span>
                                  {latestRefund && (
                                    <p className="text-[9px] text-slate-500 mt-0.5">{getSourceRefundLabel(latestRefund.sourceStatus)}</p>
                                  )}
                                </button>
                              </td>
                            )}
                            {visibleColumns.includes('profit') && (
                              <td className="px-4 py-1.5 text-right font-mono">
                                <p className={`font-black ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(profit)}</p>
                                <span className={`text-[8px] font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {profit > 0 ? '🟢 Lãi' : profit < 0 ? '🔴 Lỗ' : '🟡 Hoà'}
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {groupedByCustomer.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không có đơn xử lý sau bán nào</p>
            <p className="text-xs mt-1 text-slate-600">Thử xóa bộ lọc để xem tất cả</p>
          </div>
        )}
      </div>

      {/* --- MODAL: BATCH REFUND WITH PREVIEW --- */}
      {batchRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs max-h-[85vh] flex flex-col animate-fade-in animate-slide-up">
            <button onClick={() => setBatchRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <span>💸 Hoàn tiền hàng loạt ({selectedIds.size} đơn)</span>
            </h2>
            <p className="text-slate-400 mb-4">Nhập thông tin sự cố và xem trước bảng tính tiền hoàn trả trước khi lưu.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Lý do lỗi / hoàn tiền *</label>
                <input
                  type="text"
                  required
                  value={batchRefundReason}
                  onChange={e => setBatchRefundReason(e.target.value)}
                  placeholder="Sai mật khẩu, tài khoản lỗi..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Ngày xảy ra sự cố *</label>
                <input
                  type="date"
                  required
                  value={batchRefundErrorDate}
                  onChange={e => setBatchRefundErrorDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-[#131722]/30 mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3 text-right">Giá bán</th>
                    <th className="px-4 py-3 text-right">Giá vốn</th>
                    <th className="px-4 py-3 text-right text-rose-400 font-bold">Hoàn khách</th>
                    <th className="px-4 py-3 text-right text-emerald-400 font-bold">Nguồn hoàn</th>
                    <th className="px-4 py-3 text-right">Lãi sau hoàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batchRefundPreviews.list.map(p => (
                    <tr key={p.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-indigo-400">{p.orderCode}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-medium">{p.customerName}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{formatCurrency(p.salePrice)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatCurrency(p.costPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-400">{formatCurrency(p.clientRefund)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">+{formatCurrency(p.sourceRefund)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${p.profitAfter >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(p.profitAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aggregated totals */}
            <div className="grid grid-cols-3 gap-3.5 mb-4 p-4 rounded-xl bg-white/2 border border-white/5 text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng hoàn khách</span>
                <span className="text-sm font-black text-rose-400 font-mono mt-1 block">{formatCurrency(batchRefundPreviews.totalClientRefund)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng nguồn hoàn</span>
                <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">+{formatCurrency(batchRefundPreviews.totalSourceRefund)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Lợi nhuận sau hoàn</span>
                <span className={`text-sm font-black font-mono mt-1 block ${batchRefundPreviews.totalProfitAfter >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatCurrency(batchRefundPreviews.totalProfitAfter)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setBatchRefundModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleBatchRefundSubmit}
                disabled={bulkLoading || !batchRefundReason}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer shadow-lg shadow-rose-600/10"
              >
                {bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận hoàn tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change Popup */}
      {statusPopupOpen && statusPopupOrder && (
        <StatusChangePopup
          isOpen={statusPopupOpen}
          onClose={() => {
            setStatusPopupOpen(false);
            setStatusPopupOrder(null);
          }}
          title={`Cập nhật trạng thái - Đơn ${statusPopupOrder.orderCode}`}
          currentStatus={statusPopupOrder.status}
          allowedStatuses={[
            { value: 'WARRANTY', label: '🔵 Đang bảo hành' },
            { value: 'WARRANTY_PENDING_SOURCE', label: '🟣 Chờ hoàn nguồn' },
            { value: 'WARRANTY_PENDING_REFUND', label: '🟠 Chờ hoàn tiền khách' },
            ...(session?.user?.role === 'ADMIN' ? [
              { value: 'WARRANTY_DONE', label: '✅ Đã hoàn tất bảo hành' },
              { value: 'REFUNDED', label: '⚫ Đã hoàn tiền' },
            ] : []),
            { value: 'WARRANTY_REJECTED', label: '❌ Từ chối bảo hành' },
          ]}
          onSubmit={handleStatusChangeSubmit}
        />
      )}

      {/* --- MODAL: UNLOCK ORDER --- */}
      {unlockModalOpen && unlockOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs flex flex-col animate-fade-in animate-slide-up">
            <button onClick={() => { setUnlockModalOpen(false); setUnlockOrder(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <span>🔓 Mở khóa đơn hàng {unlockOrder.orderCode}</span>
            </h2>
            <p className="text-slate-400 mb-4 font-normal">Đơn hàng này đã hoàn tất hoặc đã hoàn tiền. Nhập lý do mở khóa để bắt đầu chỉnh sửa (Hành động này sẽ được ghi vào nhật ký hệ thống).</p>

            <form onSubmit={handleUnlockSubmit} className="space-y-4 font-normal">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Lý do mở khóa *</label>
                <input
                  type="text"
                  required
                  value={unlockReason}
                  onChange={e => setUnlockReason(e.target.value)}
                  placeholder="Ví dụ: Khách yêu cầu đổi tài khoản khác, cập nhật giá vốn..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setUnlockModalOpen(false); setUnlockOrder(null); }}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                  Xác nhận mở khóa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
