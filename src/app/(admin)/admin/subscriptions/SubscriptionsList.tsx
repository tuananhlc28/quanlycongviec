'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Search, Loader2, RefreshCcw, AlertTriangle, ShieldAlert, X, Eye, EyeOff, Shield, ArrowUpDown, ArrowUp, ArrowDown, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import CountdownBadge from '@/components/shared/CountdownBadge';
import StatusChangePopup, { StatusOption } from '@/components/shared/StatusChangePopup';
import TimeFilterDropdown, { TimeRange, DateRange } from '@/components/shared/TimeFilterDropdown';
import ColumnVisibilityToggle from '@/components/shared/ColumnVisibilityToggle';
import { saveColumnVisibility, loadColumnVisibility, filterByTimeRange } from '@/lib/tableUtils';
import StickyBottomActionBar from '@/components/shared/StickyBottomActionBar';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface Service {
  id: string;
  name: string;
  logo: string | null;
  defaultSalePrice?: number;
  defaultCostPrice?: number;
  defaultDurationDays?: number;
}

interface SupplierSource {
  id: string;
  name: string;
}

interface OrderRow {
  id: string;
  orderCode: string;
  customer: Customer;
  service: Service;
  packageName: string;
  durationDays: number;
  accountEmail: string | null;
  accountPassword: string | null;
  supplierSourceName: string | null;
  salePrice: number;
  costPrice: number;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  note: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

interface SubscriptionsListProps {
  initialOrders: OrderRow[];
  services: Service[];
  supplierSources: SupplierSource[];
}

export default function SubscriptionsList({
  initialOrders,
  services,
  supplierSources,
}: SubscriptionsListProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const clickTimeoutRef = useRef<any>(null);
  const handleEmailClick = (e: React.MouseEvent, email: string, password?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      const copyText = password ? `${email}\n${password}` : email;
      navigator.clipboard.writeText(copyText);
      toast.success('Đã sao chép Email + Password.');
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        navigator.clipboard.writeText(email);
        toast.success('Đã sao chép Email.');
      }, 250);
    }
  };

  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [activeTab, setActiveTab] = useState<'expiring_soon' | 'expired' | 'renew' | 'troubled'>('expiring_soon');

  // Time Filter States
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Status Change Popup States
  const [statusPopupOpen, setStatusPopupOpen] = useState(false);
  const [statusPopupOrder, setStatusPopupOrder] = useState<OrderRow | null>(null);

  // Checkbox selection states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Column Visibility States
  const COLUMNS_CONFIG = [
    { id: 'orderCode', label: 'Mã đơn' },
    { id: 'customer', label: 'Khách hàng' },
    { id: 'service', label: 'Dịch vụ & Gói' },
    { id: 'account', label: 'Tài khoản' },
    { id: 'startDate', label: 'Ngày bắt đầu' },
    { id: 'endDate', label: 'Ngày hết hạn' },
    { id: 'remaining', label: 'Thời hạn còn lại' },
  ];
  const DEFAULT_COLUMNS = ['orderCode', 'customer', 'service', 'account', 'startDate', 'endDate', 'remaining'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadColumnVisibility('admin_subscriptions_columns');
    setVisibleColumns(saved.length > 0 ? saved : DEFAULT_COLUMNS);
  }, []);

  // Poll for expired orders and update status in real-time
  useEffect(() => {
    const checkExpiry = async () => {
      try {
        const res = await fetch('/api/admin/orders/check-expiry', {
          method: 'POST',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.count > 0) {
            toast.success(`Đã tự động chuyển ${data.count} đơn sang Hết hạn!`);
            router.refresh();
          }
        }
      } catch (err) {
        console.error('Error running check-expiry:', err);
      }
    };

    // Check on mount
    checkExpiry();

    const interval = setInterval(checkExpiry, 60000);
    return () => clearInterval(interval);
  }, [router]);

  const handleToggleColumn = (colId: string) => {
    const next = visibleColumns.includes(colId)
      ? visibleColumns.filter(id => id !== colId)
      : [...visibleColumns, colId];
    setVisibleColumns(next);
    saveColumnVisibility('admin_subscriptions_columns', next);
  };

  // Sort states
  const [sortCol, setSortCol] = useState<string>('remainingDays');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>('asc');

  const handleSort = (col: string) => {
    if (col !== 'remainingDays') return;
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol('');
      setSortDir(null);
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span className="ml-1 text-slate-500 hover:text-slate-300">⇅</span>;
    if (sortDir === 'asc') return <span className="ml-1 text-indigo-400">▲</span>;
    return <span className="ml-1 text-indigo-400">▼</span>;
  };

  // Bulk status modals
  const [batchConfirmRefundModalOpen, setBatchConfirmRefundModalOpen] = useState(false);
  const [batchSourceStatus, setBatchSourceStatus] = useState('REFUNDED');
  const [batchSourceRefundActual, setBatchSourceRefundActual] = useState('');

  const [batchRenewModalOpen, setBatchRenewModalOpen] = useState(false);
  const [batchRenewDays, setBatchRenewDays] = useState('30');
  const [batchRenewSalePrice, setBatchRenewSalePrice] = useState('');
  const [batchRenewCostPrice, setBatchRenewCostPrice] = useState('');
  const [batchRenewNote, setBatchRenewNote] = useState('');

  // Password visibility maps
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const togglePasswordVisibility = (orderId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Renew modal states (individual)
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [renewDays, setRenewDays] = useState('30');
  const [renewSalePrice, setRenewSalePrice] = useState('');
  const [renewCostPrice, setRenewCostPrice] = useState('');
  const [renewNote, setRenewNote] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Parse remaining time
  const processedOrders = useMemo(() => {
    const now = new Date();
    return initialOrders.map((o) => {
      const end = new Date(o.endDate);
      const diffMs = end.getTime() - now.getTime();
      const remainingDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      return {
        ...o,
        remainingDays,
      };
    });
  }, [initialOrders]);

  // Filter list
  const filteredOrders = useMemo(() => {
    let filtered = processedOrders;
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

    return filtered.filter((o) => {
      // Search matches
      if (search) {
        const term = search.toLowerCase();
        const matchesSearch =
          o.orderCode.toLowerCase().includes(term) ||
          o.customer.name.toLowerCase().includes(term) ||
          (o.accountEmail && o.accountEmail.toLowerCase().includes(term)) ||
          (o.customer.phone && o.customer.phone.includes(term));
        if (!matchesSearch) return false;
      }

      // Filter select dropdowns
      if (selectedService && o.service.id !== selectedService) return false;
      if (selectedSource) {
        if (!o.supplierSourceName) return false;
        const src = supplierSources.find(s => s.id === selectedSource);
        if (src && !o.supplierSourceName.toLowerCase().includes(src.name.toLowerCase())) return false;
      }

      const isActiveSubscription = ['ACTIVE', 'EXPIRING_SOON', 'WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(o.status);
      const isTroubled = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(o.status);

      // Tab segregation
      if (activeTab === 'troubled') {
        return isTroubled;
      } else if (activeTab === 'expiring_soon') {
        return !isTroubled && ['ACTIVE', 'EXPIRING_SOON'].includes(o.status) && o.remainingDays >= 0 && o.remainingDays <= 7;
      } else if (activeTab === 'expired') {
        return !isTroubled && o.remainingDays < 0 && (isActiveSubscription || o.status === 'EXPIRED');
      } else if (activeTab === 'renew') {
        return !isTroubled && ['ACTIVE', 'EXPIRING_SOON'].includes(o.status) && o.remainingDays > 7;
      }

      return true;
    });
  }, [processedOrders, search, selectedService, selectedSource, activeTab, supplierSources, timeRange, customStart, customEnd, dateRange]);

  // Sort filtered orders
  const sortedOrders = useMemo(() => {
    const getPriority = (o: any) => {
      if (o.status === 'WARRANTY') return 1;
      if (o.status === 'WARRANTY_PENDING_SOURCE') return 2;
      if (o.status === 'WARRANTY_PENDING_REFUND') return 3;
      const isExpiring = ['ACTIVE', 'EXPIRING_SOON'].includes(o.status) && o.remainingDays >= 0 && o.remainingDays <= 7;
      if (isExpiring) return 4;
      const isNormal = ['ACTIVE', 'EXPIRING_SOON'].includes(o.status) && o.remainingDays > 7;
      if (isNormal) return 5;
      return 6; // EXPIRED, REFUNDED, etc.
    };

    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) {
        return pA - pB;
      }

      if (sortCol && sortDir) {
        let valA: any, valB: any;
        switch (sortCol) {
          case 'remainingDays':
            valA = a.remainingDays;
            valB = b.remainingDays;
            break;
          default:
            return 0;
        }
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return a.remainingDays - b.remainingDays;
    });
    return sorted;
  }, [filteredOrders, sortCol, sortDir]);

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
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ', { id: loadingToast });
    }
  };

  // Open quick renew modal (individual)
  const openRenewModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setRenewDays('30');
    setRenewSalePrice(order.salePrice.toString());
    setRenewCostPrice(order.costPrice.toString());
    setRenewNote('');
    setRenewModalOpen(true);
  };

  // Submit quick renew (individual)
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const days = parseInt(renewDays);
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error('Số ngày gia hạn phải từ 1 đến 365 ngày');
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysToExtend: days,
          additionalSalePrice: renewSalePrice === '' ? 0 : parseFloat(renewSalePrice),
          additionalCostPrice: renewCostPrice === '' ? 0 : parseFloat(renewCostPrice),
          note: renewNote,
        }),
      });

      if (res.ok) {
        toast.success('Gia hạn thuê bao thành công!');
        setRenewModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gia hạn thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit Batch Operations
  const handleBatchAction = async (action: string, payload?: any) => {
    if (selectedOrderIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một tài khoản');
      return;
    }
    
    let confirmMsg = '';
    if (action === 'DELETE') {
      confirmMsg = `Bạn có chắc chắn muốn XÓA HÀNG LOẠT ${selectedOrderIds.length} tài khoản này không? Hành động này không thể khôi phục!`;
    } else if (action === 'RENEW') {
      confirmMsg = `Xác nhận gia hạn hàng loạt cho ${selectedOrderIds.length} tài khoản?`;
    } else if (action === 'UPDATE_STATUS') {
      confirmMsg = `Xác nhận thay đổi trạng thái hàng loạt cho ${selectedOrderIds.length} tài khoản?`;
    } else if (action === 'report_error') {
      confirmMsg = `Xác nhận báo lỗi hàng loạt cho ${selectedOrderIds.length} tài khoản?`;
    } else {
      confirmMsg = `Xác nhận thực hiện thao tác hàng loạt cho ${selectedOrderIds.length} tài khoản đã chọn?`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    setBatchLoading(true);
    try {
      const url = action === 'report_error' ? '/api/admin/orders/batch-warranty' : '/api/admin/orders/batch';
      const body = action === 'report_error'
        ? { orderIds: selectedOrderIds, action: 'report_error', note: payload?.note }
        : { orderIds: selectedOrderIds, action, payload };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Thao tác hàng loạt hoàn tất!');
        setSelectedOrderIds([]);
        setBatchConfirmRefundModalOpen(false);
        setBatchRenewModalOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setBatchLoading(false);
    }
  };

  // Export selected items as CSV
  const handleExportSelectedCSV = () => {
    if (selectedOrderIds.length === 0) return;
    const selectedOrders = initialOrders.filter(o => selectedOrderIds.includes(o.id));
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Dịch vụ', 'Gói', 'Email tài khoản', 'Mật khẩu tài khoản', 'Giá bán', 'Giá vốn', 'Ngày hết hạn', 'Trạng thái'];
    const rows = selectedOrders.map(o => [
      o.orderCode,
      o.customer?.name || '',
      o.customer?.phone || '',
      o.service?.name || '',
      o.packageName,
      o.accountEmail || '',
      o.accountPassword || '',
      o.salePrice,
      o.costPrice,
      formatDate(o.endDate),
      o.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CRM_TaiKhoan_Chon_${selectedOrderIds.length}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="p-4 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm khách hàng, mã đơn, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Service dropdown */}
          <div>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#1a1f2e] border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-all"
            >
              <option value="">Lọc theo dịch vụ</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Source dropdown */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#1a1f2e] border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-all"
            >
              <option value="">Lọc theo nguồn hàng</option>
              {supplierSources.map(src => (
                <option key={src.id} value={src.id}>{src.name}</option>
              ))}
            </select>
          </div>

          {/* Time Filter & Columns Toggle */}
          <div className="flex gap-2 w-full">
            <div className="flex-1">
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
            </div>
            <ColumnVisibilityToggle
              columns={COLUMNS_CONFIG}
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
              storageKey="admin_subscriptions_columns"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('troubled')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'troubled'
              ? 'border-purple-500 text-purple-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          Tài khoản gặp sự cố
        </button>
        <button
          onClick={() => setActiveTab('expiring_soon')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'expiring_soon'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Tài khoản sắp hết hạn
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'expired'
              ? 'border-rose-500 text-rose-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Tài khoản đã hết hạn
        </button>
        <button
          onClick={() => setActiveTab('renew')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'renew'
              ? 'border-indigo-500 text-indigo-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <RefreshCcw className="w-4 h-4 text-indigo-400" />
          Danh sách tài khoản
        </button>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4 w-12 text-center">STT</th>
              <th className="px-6 py-4 w-12 text-center">
                <input
                  type="checkbox"
                  className="rounded bg-white/5 border border-white/10 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrderIds.includes(o.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedOrderIds(filteredOrders.map(o => o.id));
                    } else {
                      setSelectedOrderIds([]);
                    }
                  }}
                />
              </th>
              {visibleColumns.includes('orderCode') && <th className="px-6 py-4">Mã đơn</th>}
              {visibleColumns.includes('customer') && <th className="px-6 py-4">Khách hàng</th>}
              {visibleColumns.includes('service') && <th className="px-6 py-4">Dịch vụ & Gói</th>}
              {visibleColumns.includes('account') && <th className="px-6 py-4">Tài khoản</th>}
              {visibleColumns.includes('startDate') && <th className="px-6 py-4">Ngày bắt đầu</th>}
              {visibleColumns.includes('endDate') && <th className="px-6 py-4">Ngày hết hạn</th>}
              {visibleColumns.includes('remaining') && (
                <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('remainingDays')}>
                  Thời hạn còn lại <SortIcon col="remainingDays" />
                </th>
              )}
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-300">
            {sortedOrders.map((o, idx) => {
              return (
                <tr key={o.id} className="hover:bg-white/2 transition-colors table-row-hover">
                  <td className="px-6 py-4 w-12 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="px-6 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded bg-white/5 border border-white/10 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrderIds(prev => [...prev, o.id]);
                        } else {
                          setSelectedOrderIds(prev => prev.filter(id => id !== o.id));
                        }
                      }}
                    />
                  </td>
                  {visibleColumns.includes('orderCode') && (
                    <td className="px-6 py-4">
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-indigo-400 hover:underline">
                        {o.orderCode}
                      </Link>
                    </td>
                  )}
                  {visibleColumns.includes('customer') && (
                    <td className="px-6 py-4">
                      <div>
                        {o.customer?.id ? (
                          <Link href={`/admin/customers/${o.customer.id}`} className="font-bold text-white hover:text-indigo-400 transition-colors text-sm">
                            {o.customer.name}
                          </Link>
                        ) : (
                          <p className="font-bold text-white text-sm">{o.customer?.name || 'N/A'}</p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5">{o.customer?.phone || 'No phone'}</p>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('service') && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{o.service?.logo || '🔑'}</span>
                        <div>
                          <button
                            onClick={() => setSelectedService(o.service.id)}
                            className="font-semibold text-white hover:text-indigo-400 hover:underline text-left cursor-pointer focus:outline-none"
                          >
                            {o.service?.name}
                          </button>
                          <p className="text-xs text-slate-500">{o.packageName}</p>
                        </div>
                      </div>
                    </td>
                  )}
                  {visibleColumns.includes('account') && (
                    <td className="px-6 py-4">
                      {o.accountEmail ? (
                        <div className="space-y-1 text-xs max-w-[200px]">
                          <button
                            onClick={(e) => handleEmailClick(e, o.accountEmail!, o.accountPassword || undefined)}
                            className="font-medium text-indigo-400 hover:underline truncate block text-left cursor-pointer focus:outline-none w-full"
                            title="Click 1 lần để copy Email, double click để copy Email + Password"
                          >
                            {o.accountEmail}
                          </button>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="font-mono">
                              {visiblePasswords[o.id] ? o.accountPassword : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(o.id)}
                              className="text-slate-600 hover:text-slate-400 cursor-pointer focus:outline-none"
                              title="Hiện/Ẩn mật khẩu"
                            >
                              {visiblePasswords[o.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.includes('startDate') && <td className="px-6 py-4 text-xs font-mono">{formatDate(o.startDate)}</td>}
                  {visibleColumns.includes('endDate') && <td className="px-6 py-4 text-xs font-mono">{o.status === 'COMPLETED' ? 'N/A' : formatDate(o.endDate)}</td>}
                  {visibleColumns.includes('remaining') && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setStatusPopupOrder(o);
                          setStatusPopupOpen(true);
                        }}
                        className="hover:opacity-85 transition-all text-left focus:outline-none cursor-pointer"
                        title="Nhấp để thay đổi trạng thái đơn hàng"
                      >
                        <CountdownBadge endDate={o.endDate} status={o.status} completedAt={o.updatedAt} />
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => openRenewModal(o)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/10 cursor-pointer focus:outline-none"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Gia hạn
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-slate-500 text-sm">
                  Không tìm thấy tài khoản nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating Bulk Action Bar */}
      <StickyBottomActionBar
        selectedCount={selectedOrderIds.length}
        onClearSelection={() => setSelectedOrderIds([])}
        actions={[
          {
            label: 'Báo sự cố hàng loạt',
            onClick: () => {
              const note = prompt('Nhập lý do báo sự cố hàng loạt (tùy chọn):');
              if (note !== null) {
                handleBatchAction('report_error', { note });
              }
            },
            variant: 'danger' as const,
            disabled: batchLoading,
          },
          {
            label: 'Cập nhật hoàn nguồn',
            onClick: () => setBatchConfirmRefundModalOpen(true),
            variant: 'purple' as const,
          },
          {
            label: 'Gia hạn hàng loạt',
            onClick: () => setBatchRenewModalOpen(true),
            variant: 'success' as const,
          },
          {
            label: 'Xuất Excel',
            onClick: handleExportSelectedCSV,
            variant: 'secondary' as const,
          }
        ]}
      />

      {/* Individual Renew Modal */}
      {renewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white">
            <button
              onClick={() => setRenewModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <RefreshCcw className="w-5 h-5 text-indigo-400" />
              Gia hạn thuê bao
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Mã đơn: <strong className="text-white">{selectedOrder.orderCode}</strong> — Khách hàng: <strong className="text-white">{selectedOrder.customer.name}</strong>
            </p>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Số ngày gia hạn
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {['30', '60', '90', '180', '365'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setRenewDays(d)}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all border cursor-pointer ${
                        renewDays === d
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      {d} ngày
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max="365"
                  value={renewDays}
                  onChange={(e) => setRenewDays(e.target.value)}
                  placeholder="Nhập số ngày tự chọn..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Giá bán gia hạn (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={renewSalePrice}
                    onChange={(e) => setRenewSalePrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Giá vốn gia hạn (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={renewCostPrice}
                    onChange={(e) => setRenewCostPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Ghi chú gia hạn
                </label>
                <textarea
                  value={renewNote}
                  onChange={(e) => setRenewNote(e.target.value)}
                  placeholder="Ví dụ: Khách thanh toán qua bank..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Confirm Source Refund Modal */}
      {batchConfirmRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setBatchConfirmRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white focus:outline-none"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Cập nhật trạng thái hoàn tiền ({selectedOrderIds.length} tài khoản)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Trạng thái hoàn tiền của nguồn hàng *</label>
                <select
                  value={batchSourceStatus}
                  onChange={(e) => setBatchSourceStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                >
                  <option value="REFUNDED">🟢 Đã hoàn tiền</option>
                  <option value="REJECTED">🔴 Từ chối hoàn tiền</option>
                  <option value="PENDING">🟡 Đang xử lý</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Số tiền nguồn hoàn (để trống = dùng số dự kiến)</label>
                <input
                  type="number"
                  value={batchSourceRefundActual}
                  onChange={(e) => setBatchSourceRefundActual(e.target.value)}
                  placeholder="Dự kiến hoàn"
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchConfirmRefundModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button
                  type="button"
                  onClick={() => handleBatchAction('CONFIRM_SOURCE_REFUND', {
                    sourceRefundActual: batchSourceRefundActual ? parseFloat(batchSourceRefundActual) : undefined,
                    sourceStatus: batchSourceStatus
                  })}
                  disabled={batchLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Renew Modal */}
      {batchRenewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setBatchRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white focus:outline-none"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Gia hạn hàng loạt ({selectedOrderIds.length} tài khoản)</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Số ngày gia hạn thêm *</label>
                <select value={batchRenewDays} onChange={e => setBatchRenewDays(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none">
                  <option value="30">30 ngày</option>
                  <option value="60">60 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">365 ngày</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Doanh thu tăng thêm (₫) *</label>
                  <input required type="number" value={batchRenewSalePrice} onChange={e => setBatchRenewSalePrice(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Giá vốn tăng thêm (₫) *</label>
                  <input required type="number" value={batchRenewCostPrice} onChange={e => setBatchRenewCostPrice(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Ghi chú gia hạn</label>
                <input type="text" value={batchRenewNote} onChange={e => setBatchRenewNote(e.target.value)} placeholder="Nhập ghi chú..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchRenewModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button
                  type="button"
                  onClick={() => handleBatchAction('RENEW', {
                    daysToExtend: parseInt(batchRenewDays),
                    additionalSalePrice: batchRenewSalePrice ? parseFloat(batchRenewSalePrice) : 0,
                    additionalCostPrice: batchRenewCostPrice ? parseFloat(batchRenewCostPrice) : 0,
                    note: batchRenewNote
                  })}
                  disabled={batchLoading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
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
            { value: 'ACTIVE', label: '🟢 Đang sử dụng' },
            { value: 'EXPIRING_SOON', label: '🟡 Sắp hết hạn' },
            { value: 'EXPIRED', label: '🔴 Đã hết hạn' },
            { value: 'WARRANTY', label: '🔵 Đang bảo hành' },
            { value: 'WARRANTY_PENDING_SOURCE', label: '🟣 Chờ hoàn nguồn' },
            { value: 'WARRANTY_PENDING_REFUND', label: '🟠 Chờ hoàn tiền khách' },
            ...(isAdmin ? [
              { value: 'WARRANTY_DONE', label: '✅ Đã hoàn tất bảo hành' },
              { value: 'REFUNDED', label: '⚫ Đã hoàn tiền' },
            ] : []),
            { value: 'WARRANTY_REJECTED', label: '❌ Từ chối bảo hành' },
          ]}
          onSubmit={handleStatusChangeSubmit}
        />
      )}
    </div>
  );
}
