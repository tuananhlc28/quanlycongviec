'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, Calendar, RefreshCcw, AlertTriangle, CheckCircle, ShieldAlert, X, DollarSign, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [activeTab, setActiveTab] = useState<'expiring_soon' | 'expired' | 'renew'>('expiring_soon');

  // Renew modal states
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [renewDays, setRenewDays] = useState('30');
  const [renewSalePrice, setRenewSalePrice] = useState('');
  const [renewCostPrice, setRenewCostPrice] = useState('');
  const [renewNote, setRenewNote] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Parse order status / duration recency
  const processedOrders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return initialOrders.map((o) => {
      const end = new Date(o.endDate);
      end.setHours(0, 0, 0, 0);
      const diffMs = end.getTime() - now.getTime();
      const remainingDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

      return {
        ...o,
        remainingDays,
      };
    });
  }, [initialOrders]);

  // Filter based on search/filters & activeTab
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
      if (selectedSource && o.supplierSourceName && !o.supplierSourceName.toLowerCase().includes(selectedSource.toLowerCase())) {
        // supplierSource checks
        const src = supplierSources.find(s => s.id === selectedSource);
        if (src && !o.supplierSourceName.toLowerCase().includes(src.name.toLowerCase())) return false;
      }

      // Tab segregation
      if (activeTab === 'expiring_soon') {
        // Expiring in <= 7 days, and is ACTIVE or EXPIRING_SOON
        return (o.status === 'ACTIVE' || o.status === 'EXPIRING_SOON') && o.remainingDays >= 0 && o.remainingDays <= 7;
      } else if (activeTab === 'expired') {
        // Expired (remainingDays < 0)
        return o.remainingDays < 0 && (o.status === 'ACTIVE' || o.status === 'EXPIRED' || o.status === 'EXPIRING_SOON');
      } else if (activeTab === 'renew') {
        // All active subscriptions (active orders, regardless of end date)
        return o.status === 'ACTIVE' || o.status === 'EXPIRING_SOON';
      }

      return true;
    });
  }, [processedOrders, search, selectedService, selectedSource, activeTab, supplierSources]);

  // Open quick renew modal
  const openRenewModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setRenewDays('30');
    // Pre-populate with current pricing or defaults from service
    setRenewSalePrice(order.salePrice.toString());
    setRenewCostPrice(order.costPrice.toString());
    setRenewNote('');
    setRenewModalOpen(true);
  };

  // Submit quick renew
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const days = parseInt(renewDays);
    if (isNaN(days) || days < 1 || days > 365) {
      toast.error('Số ngày gia hạn phải nằm trong khoảng từ 1 đến 365');
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

          {/* Dịch vụ */}
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-all"
          >
            <option value="">Lọc theo dịch vụ</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Nguồn hàng */}
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-[#131722] border border-white/10 text-white focus:border-indigo-500 focus:outline-none transition-all"
          >
            <option value="">Lọc theo nguồn hàng</option>
            {supplierSources.map(src => (
              <option key={src.id} value={src.id}>{src.name}</option>
            ))}
          </select>
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
          Sắp hết hạn (≤ 7 ngày)
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
          Đã hết hạn
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
          Danh sách gia hạn
        </button>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-4 w-12 text-center">STT</th>
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
            {filteredOrders.map((o, idx) => {
              let recencyBadge = '';
              let badgeColor = '';
              if (o.remainingDays < 0) {
                recencyBadge = `Đã quá hạn ${Math.abs(o.remainingDays)} ngày`;
                badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
              } else if (o.remainingDays === 0) {
                recencyBadge = 'Hết hạn hôm nay';
                badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
              } else {
                recencyBadge = `Còn ${o.remainingDays} ngày`;
                badgeColor = o.remainingDays <= 7
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
              }

              return (
                <tr key={o.id} className="hover:bg-white/2 transition-colors table-row-hover">
                  <td className="px-6 py-4 text-center text-slate-500 font-mono text-xs">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-indigo-400 hover:underline">
                      {o.orderCode}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-white text-sm">{o.customer?.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{o.customer?.phone || 'No phone'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{o.service?.logo || '🔑'}</span>
                      <div>
                        <p className="font-semibold text-white">{o.service?.name}</p>
                        <p className="text-xs text-slate-500">{o.packageName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-[200px] truncate text-xs font-mono" title={o.accountEmail || ''}>
                    {o.accountEmail || '—'}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono">{formatDate(o.startDate)}</td>
                  <td className="px-6 py-4 text-xs font-mono">{formatDate(o.endDate)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold px-2.5 py-0.5 rounded ${badgeColor}`}>
                      {recencyBadge}
                    </span>
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
                <td colSpan={9} className="px-6 py-12 text-center text-slate-500 text-sm">
                  Không tìm thấy thuê bao nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Renew Modal */}
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
              {/* Preset buttons */}
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
                {/* Giá bán gia hạn */}
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

                {/* Giá vốn gia hạn */}
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

              {/* Ghi chú */}
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

              {/* Submit Buttons */}
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
    </div>
  );
}
