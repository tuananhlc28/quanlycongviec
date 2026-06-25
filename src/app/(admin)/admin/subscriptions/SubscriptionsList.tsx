'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, RefreshCcw, AlertTriangle, ShieldAlert, X, Eye, EyeOff, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import CountdownBadge from '@/components/shared/CountdownBadge';

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
  const [activeTab, setActiveTab] = useState<'expiring_soon' | 'expired' | 'renew'>('expiring_soon');

  // Checkbox selection states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

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
    return processedOrders.filter((o) => {
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

      // Tab segregation
      if (activeTab === 'expiring_soon') {
        return isActiveSubscription && o.remainingDays >= 0 && o.remainingDays <= 7;
      } else if (activeTab === 'expired') {
        return o.remainingDays < 0 && (isActiveSubscription || o.status === 'EXPIRED');
      } else if (activeTab === 'renew') {
        return isActiveSubscription;
      }

      return true;
    });
  }, [processedOrders, search, selectedService, selectedSource, activeTab, supplierSources]);

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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('expiring_soon')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'expiring_soon'
              ? 'border-amber-500 text-amber-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Sắp hết hạn tài khoản
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'expired'
              ? 'border-rose-500 text-rose-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Tài khoản hết hạn
        </button>
        <button
          onClick={() => setActiveTab('renew')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
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
              <th className="px-6 py-4">Mã đơn</th>
              <th className="px-6 py-4">Khách hàng</th>
              <th className="px-6 py-4">Dịch vụ & Gói</th>
              <th className="px-6 py-4">Tài khoản</th>
              <th className="px-6 py-4">Ngày bắt đầu</th>
              <th className="px-6 py-4">Ngày hết hạn</th>
              <th className="px-6 py-4">Thời hạn còn lại</th>
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-300">
            {filteredOrders.map((o) => {
              return (
                <tr key={o.id} className="hover:bg-white/2 transition-colors table-row-hover">
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
                  <td className="px-6 py-4">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-indigo-400 hover:underline">
                      {o.orderCode}
                    </Link>
                  </td>
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
                  <td className="px-6 py-4 text-xs font-mono">{formatDate(o.startDate)}</td>
                  <td className="px-6 py-4 text-xs font-mono">{formatDate(o.endDate)}</td>
                  <td className="px-6 py-4">
                    <CountdownBadge endDate={o.endDate} status={o.status} />
                  </td>
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
            {filteredOrders.length === 0 && (
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
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-3 px-6 py-3.5 rounded-2xl bg-[#131722] border border-indigo-500/30 shadow-2xl animate-slide-up text-white text-xs max-w-[95%]">
          <div className="flex items-center gap-2 border-r border-white/10 pr-4">
            <span className="font-bold text-indigo-400">Đã chọn: {selectedOrderIds.length} tài khoản</span>
            {selectedOrderIds.length < filteredOrders.length && (
              <button
                onClick={() => setSelectedOrderIds(filteredOrders.map(o => o.id))}
                className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white transition-all cursor-pointer ml-1"
              >
                Chọn tất cả {filteredOrders.length} tài khoản
              </button>
            )}
            <button
              onClick={() => setSelectedOrderIds([])}
              className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer ml-1.5"
            >
              Bỏ chọn
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const note = prompt('Nhập lý do báo sự cố hàng loạt (tùy chọn):');
                if (note !== null) {
                  handleBatchAction('report_error', { note });
                }
              }}
              disabled={batchLoading}
              className="px-2.5 py-1.5 rounded-lg font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
            >
              🚨 Báo sự cố hàng loạt
            </button>
            <button
              onClick={() => setBatchConfirmRefundModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg font-semibold bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 transition-all cursor-pointer"
            >
              🤝 Cập nhật trạng thái hoàn tiền
            </button>
            <button
              onClick={() => setBatchRenewModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-all cursor-pointer"
            >
              🔄 Gia hạn hàng loạt
            </button>
            <button
              onClick={handleExportSelectedCSV}
              className="px-2.5 py-1.5 rounded-lg font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all cursor-pointer"
            >
              📥 Xuất Excel
            </button>
          </div>
        </div>
      )}

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
    </div>
  );
}
