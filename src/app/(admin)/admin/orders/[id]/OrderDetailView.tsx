'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  User,
  Mail,
  Phone,
  Clock,
  KeyRound,
  Shield,
  Tag,
  Warehouse,
  TrendingUp,
  Edit,
  RotateCcw,
  DollarSign,
  X,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  MessageCircle,
  ExternalLink,
  Info,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  History,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor, getPaymentStatusLabel, getPaymentStatusColor } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  facebook: string | null;
  telegram: string | null;
}

interface Service {
  id: string;
  name: string;
  logo: string | null;
  serviceType?: string | null;
  defaultSalePrice?: number;
  defaultCostPrice?: number;
  defaultDurationDays?: number;
}

interface SupplierSource {
  id: string;
  name: string;
}

interface RefundHistory {
  id: string;
  amount: number;
  daysUsed: number;
  daysRemaining: number;
  costPerDay: number;
  errorDate: string | Date | null;
  operatorName: string | null;
  note: string | null;
  sourceAmount?: number;
  sourceRefundExpected?: number;
  sourceRefundActual?: number;
  sourceStatus?: string;
  netProfitAfterRefund?: number;
  createdAt: string | Date;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

interface ActivityLogItem {
  id: string;
  userId: string | null;
  user: UserInfo | null;
  action: string;
  target: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string | Date;
}

interface OrderRow {
  id: string;
  orderCode: string;
  customerId: string;
  customer: Customer;
  serviceId: string;
  service: Service;
  packageName: string;
  durationDays: number;
  accountEmail: string | null;
  accountPassword: string | null;
  recoveryCode: string | null;
  loginLink: string | null;
  accountNote: string | null;
  supplierSourceId: string | null;
  supplierSourceName: string | null;
  salePrice: number;
  costPrice: number;
  profit: number;
  startDate: string | Date;
  endDate: string | Date;
  paymentStatus: string;
  paymentDueDate: string | Date | null;
  paidAt: string | Date | null;
  paidAmount: number;
  status: string;
  note: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  refundHistories: RefundHistory[];
}

interface OrderDetailViewProps {
  order: OrderRow;
  supplierSources: SupplierSource[];
  services: Service[];
  activityLogs: ActivityLogItem[];
}



export default function OrderDetailView({
  order,
  supplierSources,
  services,
  activityLogs,
}: OrderDetailViewProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdatePaymentStatus = async (newStatus: string) => {
    const loadingToast = toast.loading('Đang cập nhật trạng thái thanh toán...');
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newStatus,
          paymentMethod: newStatus === 'PAID' ? 'bank' : undefined,
          paymentNote: newStatus === 'PAID' ? 'Cập nhật thanh toán trực tiếp từ trang chi tiết' : undefined,
        }),
      });
      if (res.ok) {
        toast.success('Cập nhật trạng thái thanh toán thành công!', { id: loadingToast });
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối', { id: loadingToast });
    }
  };

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Edit form state
  const [editServiceId, setEditServiceId] = useState(order.serviceId);
  const [editPackageName, setEditPackageName] = useState(order.packageName);
  const [editDurationDays, setEditDurationDays] = useState(order.durationDays.toString());
  const [editSupplierSourceId, setEditSupplierSourceId] = useState(order.supplierSourceId || '');
  const [editAccountEmail, setEditAccountEmail] = useState(order.accountEmail || '');
  const [editAccountPassword, setEditAccountPassword] = useState(order.accountPassword || '');
  const [editRecoveryCode, setEditRecoveryCode] = useState(order.recoveryCode || '');
  const [editLoginLink, setEditLoginLink] = useState(order.loginLink || '');
  const [editAccountNote, setEditAccountNote] = useState(order.accountNote || '');
  const [editSalePrice, setEditSalePrice] = useState(order.salePrice.toString());
  const [editCostPrice, setEditCostPrice] = useState(order.costPrice.toString());
  const [editStartDate, setEditStartDate] = useState(new Date(order.startDate).toISOString().split('T')[0]);
  const [editEndDate, setEditEndDate] = useState(new Date(order.endDate).toISOString().split('T')[0]);
  const [editStatus, setEditStatus] = useState(order.status);
  const [editNote, setEditNote] = useState(order.note || '');
  const [priceChangeReason, setPriceChangeReason] = useState('');

  // Renew form state
  const [renewDays, setRenewDays] = useState('30');
  const [renewSalePrice, setRenewSalePrice] = useState('');
  const [renewCostPrice, setRenewCostPrice] = useState('');
  const [renewNote, setRenewNote] = useState('');

  // Warranty form state
  const [warrantyErrorDate, setWarrantyErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [warrantyNote, setWarrantyNote] = useState('');

  // Resolve warranty form state
  const [resolveNote, setResolveNote] = useState('');

  // Refund form state
  const [refundErrorDate, setRefundErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundReason, setRefundReason] = useState('');
  const [refundOverrideAmount, setRefundOverrideAmount] = useState('');
  const [refundOverrideSourceRefundActual, setRefundOverrideSourceRefundActual] = useState('');
  const [overrideSourceRefund, setOverrideSourceRefund] = useState(false);
  const [refundTargetStatus, setRefundTargetStatus] = useState<'PENDING_REFUND' | 'REFUNDED'>('REFUNDED');

  // Computations for days remaining/used
  const now = new Date();
  const start = new Date(order.startDate);
  const end = new Date(order.endDate);
  const totalDays = order.durationDays || 30;

  const usedDiff = now.getTime() - start.getTime();
  const daysUsed = Math.min(totalDays, Math.max(0, Math.floor(usedDiff / (24 * 60 * 60 * 1000))));
  const daysRemaining = Math.max(0, totalDays - daysUsed);

  // Dynamic refund calculation
  const refundCalculation = useMemo(() => {
    const errorDateObj = refundErrorDate ? new Date(refundErrorDate) : new Date();
    const diff = errorDateObj.getTime() - start.getTime();
    let computedDaysUsed = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (computedDaysUsed < 0) computedDaysUsed = 0;
    if (computedDaysUsed > totalDays) computedDaysUsed = totalDays;

    const computedDaysRemaining = totalDays - computedDaysUsed;
    const costPerDay = order.salePrice / totalDays;
    const computedRefundAmount = Math.max(0, Math.round(computedDaysRemaining * costPerDay));

    const supplierCostPerDay = order.costPrice / totalDays;
    const computedSourceRefundExpected = Math.max(0, Math.round(computedDaysRemaining * supplierCostPerDay));

    return {
      daysUsed: computedDaysUsed,
      daysRemaining: computedDaysRemaining,
      costPerDay,
      computedAmount: computedRefundAmount,
      supplierCostPerDay,
      computedSourceRefundExpected,
    };
  }, [refundErrorDate, order.salePrice, order.costPrice, totalDays, start]);

  // Profit calculated dynamically after refund
  const dynamicNetProfit = useMemo(() => {
    const sale = order.salePrice;
    const cost = order.costPrice;
    const clientRefund = refundOverrideAmount !== '' 
      ? (parseFloat(refundOverrideAmount) || 0)
      : refundCalculation.computedAmount;
    const sourceRefund = overrideSourceRefund
      ? (parseFloat(refundOverrideSourceRefundActual) || 0)
      : refundCalculation.computedSourceRefundExpected;
    return sale - cost - clientRefund + sourceRefund;
  }, [order.salePrice, order.costPrice, refundOverrideAmount, refundOverrideSourceRefundActual, overrideSourceRefund, refundCalculation]);

  // #49 - Timeline
  const timelineSteps = useMemo(() => {
    const latestRefund = order.refundHistories?.[0];
    const steps = [
      { label: 'Tạo đơn', date: order.createdAt, icon: '🎉', done: true },
      { label: 'Thanh toán', date: order.paymentStatus === 'PAID' ? order.paidAt : null, icon: '💳', done: order.paymentStatus === 'PAID' },
      { label: 'Đang sử dụng', date: order.startDate, icon: '🟢', done: true },
      { label: 'Báo lỗi', date: latestRefund?.errorDate, icon: '🔵', done: ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(order.status) },
      { label: 'Chờ nguồn', date: null, icon: '🟣', done: ['WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(order.status) },
      { label: 'Nguồn hoàn', date: null, icon: '✅', done: ['WARRANTY_PENDING_REFUND', 'WARRANTY_DONE'].includes(order.status) },
      { label: 'Hoàn khách', date: latestRefund?.createdAt, icon: '💸', done: order.status === 'WARRANTY_DONE' },
      { label: 'Hoàn tất', date: null, icon: '🏁', done: order.status === 'WARRANTY_DONE' },
    ];
    if (order.status === 'WARRANTY_REJECTED') {
      steps[5] = { label: 'Nguồn từ chối', date: null, icon: '⛔', done: true };
      steps[6] = { label: 'Từ chối BH', date: null, icon: '❌', done: true };
      steps[7] = { label: '—', date: null, icon: '—', done: false };
    }
    return steps;
  }, [order]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: editServiceId,
          packageName: editPackageName,
          durationDays: parseInt(editDurationDays),
          supplierSourceId: editSupplierSourceId || null,
          accountEmail: editAccountEmail,
          accountPassword: editAccountPassword,
          recoveryCode: editRecoveryCode,
          loginLink: editLoginLink,
          accountNote: editAccountNote,
          salePrice: parseFloat(editSalePrice),
          costPrice: parseFloat(editCostPrice),
          startDate: editStartDate,
          endDate: editEndDate,
          status: editStatus,
          note: editNote,
          priceChangeReason,
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật đơn hàng thành công!');
        setEditModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysToExtend: parseInt(renewDays || '30'),
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
      setLoading(false);
    }
  };

  const handleWarrantySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/warranty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: warrantyErrorDate,
          reason: warrantyReason || 'Không có lý do',
          note: warrantyNote,
        }),
      });

      if (res.ok) {
        toast.success('Báo sự cố bảo hành thành công!');
        setWarrantyModalOpen(false);
        setWarrantyReason('');
        setWarrantyNote('');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveWarrantySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/resolve-warranty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: resolveNote,
        }),
      });

      if (res.ok) {
        toast.success('Đã xác nhận xử lý bảo hành xong!');
        setResolveModalOpen(false);
        setResolveNote('');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Thao tác này không thể hoàn tác và sẽ xóa vĩnh viễn dữ liệu đơn hàng.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Đã xóa đơn hàng thành công!');
        router.push('/admin/orders');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Xóa đơn hàng thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRefundDone = async () => {
    if (!confirm('Xác nhận bạn đã chuyển tiền hoàn thực tế cho khách và muốn cập nhật trạng thái đơn hàng sang ĐÃ HOÀN TIỀN?')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus: 'REFUNDED',
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật trạng thái Đã hoàn tiền thành công!');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: refundErrorDate,
          reason: refundReason,
          overrideAmount: refundOverrideAmount || undefined,
          overrideSourceRefundActual: refundOverrideSourceRefundActual || undefined,
          targetStatus: refundTargetStatus,
        }),
      });

      if (res.ok) {
        toast.success('Ghi nhận hoàn tiền thành công!');
        setRefundModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Hoàn tiền thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Chi tiết đơn {order.orderCode}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getStatusColor(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
              <select
                value={order.paymentStatus}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  await handleUpdatePaymentStatus(newStatus);
                }}
                className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border bg-[#0f1320] focus:outline-none cursor-pointer ${
                  order.paymentStatus === 'PAID'
                    ? 'text-emerald-400 border-emerald-500/30'
                    : order.paymentStatus === 'OVERDUE'
                    ? 'text-rose-400 border-rose-500/30'
                    : 'text-amber-400 border-amber-500/30'
                }`}
              >
                <option value="UNPAID" className="text-amber-400">🟡 Chưa thanh toán</option>
                <option value="PAID" className="text-emerald-400">🟢 Đã thanh toán</option>
                <option value="OVERDUE" className="text-rose-400">🔴 Quá hạn</option>
              </select>
            </div>
            <p className="text-sm text-slate-400 mt-1">Thông tin chi tiết tài khoản, doanh thu và vận hành gia hạn/hoàn tiền.</p>
          </div>
        </div>

        {/* Top actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            Sửa đơn
          </button>

          <button
            onClick={handleDeleteOrder}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Xóa đơn
          </button>

          {/* Warranty statuses linking to full warranty page */}
          {['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(order.status) && (
            <Link
              href={`/admin/warranty/${order.id}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Chi tiết bảo hành
            </Link>
          )}

          {/* Report error button */}
          {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'].includes(order.status) && (
            <button
              onClick={() => setWarrantyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4" />
              Báo lỗi
            </button>
          )}

          {/* Extend button */}
          {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'].includes(order.status) && (
            <button
              onClick={() => setRenewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Gia hạn
            </button>
          )}
        </div>
      </div>

      {/* Timeline flow display */}
      <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">📋 Quy trình bảo hành / Trạng thái đơn</h3>
        <div className="flex items-center justify-between overflow-x-auto gap-1">
          {timelineSteps.map((step, i) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 px-2 ${step.done ? 'opacity-100' : 'opacity-30'}`}>
                <span className="text-xl">{step.icon}</span>
                <span className="text-[10px] font-bold text-slate-300 whitespace-nowrap">{step.label}</span>
                {step.date && (
                  <span className="text-[9px] text-slate-500">{new Date(step.date).toLocaleDateString('vi-VN')}</span>
                )}
              </div>
              {i < timelineSteps.length - 1 && (
                <ArrowRight className={`w-4 h-4 flex-shrink-0 mx-1 ${step.done ? 'text-indigo-400' : 'text-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detail grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account, Service, Time */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Credentials */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              3. Thông tin tài khoản bàn giao
            </h3>

            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block">Email tài khoản</span>
                  <strong className="text-sm text-white block mt-1 select-all font-mono">
                    {order.accountEmail || '—'}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Mật khẩu</span>
                  <div className="flex items-center gap-2 mt-1">
                    <strong className="text-sm text-white select-all font-mono">
                      {showPassword ? (order.accountPassword || '—') : '••••••••'}
                    </strong>
                    {order.accountPassword && (
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/5">
                <div>
                  <span className="text-xs text-slate-500 block">Mã khôi phục (2FA / Backup Link)</span>
                  <span className="text-xs text-slate-300 block mt-1 select-all font-mono">
                    {order.recoveryCode || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Đường dẫn đăng nhập</span>
                  {order.loginLink ? (
                    <a
                      href={order.loginLink.startsWith('http') ? order.loginLink : `https://${order.loginLink}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Đi đến trang đăng nhập
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 block mt-1">—</span>
                  )}
                </div>
              </div>

              {order.accountNote && (
                <div className="p-3 rounded-lg bg-white/2 border border-white/5 text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>Hướng dẫn đăng nhập: {order.accountNote}</span>
                </div>
              )}
            </div>
          </div>

          {/* Service Info */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <Shield className="w-5 h-5 text-indigo-400" />
              2. Thông tin dịch vụ đăng ký
            </h3>

            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-2xl font-bold">
                  {order.service.logo || '🔑'}
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">{order.service.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">Gói: <strong className="text-indigo-300">{order.packageName}</strong></p>
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-500">Thời hạn gói đăng ký</span>
                <p className="text-sm font-bold text-white mt-1">{order.durationDays} ngày sử dụng</p>
              </div>
            </div>
          </div>

          {/* Time Validity pro-rata breakdown */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="w-5 h-5 text-indigo-400" />
              6. Thông tin thời hạn & Chu kỳ sử dụng
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Ngày bắt đầu</span>
                <strong className="text-xs text-white block mt-1">{formatDate(order.startDate)}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Ngày hết hạn</span>
                <strong className="text-xs text-red-400 block mt-1">{formatDate(order.endDate)}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Đã sử dụng</span>
                <strong className="text-sm font-bold text-white block mt-1">{daysUsed} ngày</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Còn lại</span>
                <strong className="text-sm font-bold text-indigo-300 block mt-1">{daysRemaining} ngày</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Đơn giá ngày</span>
                <strong className="text-sm font-bold text-amber-400 block mt-1">{formatCurrency(order.salePrice / totalDays)}/ngày</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Giá trị đã dùng</span>
                <strong className="text-sm font-bold text-amber-550 block mt-1">{formatCurrency(Math.round(daysUsed * (order.salePrice / totalDays)))}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 text-center">
                <span className="text-[10px] text-slate-500 uppercase block font-semibold">Giá trị còn lại</span>
                <strong className="text-sm font-bold text-emerald-400 block mt-1">{formatCurrency(Math.round(daysRemaining * (order.salePrice / totalDays)))}</strong>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.note && (
            <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-3 text-sm">
              <h4 className="font-bold text-slate-400">Ghi chú vận hành đơn hàng</h4>
              <p className="text-slate-300 whitespace-pre-line leading-relaxed italic">{order.note}</p>
            </div>
          )}

          {/* Order Activity Timeline */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <History className="w-5 h-5 text-indigo-400" />
              Nhật ký hoạt động đơn hàng
            </h3>

            <div className="space-y-4 pl-2 border-l border-white/5 mt-4">
              {activityLogs && activityLogs.length > 0 ? (
                activityLogs.map((log) => {
                  const logDate = new Date(log.createdAt);
                  return (
                    <div key={log.id} className="relative pl-6 pb-2 last:pb-0">
                      {/* Timeline dot */}
                      <span className="absolute -left-[9px] top-1 w-4.5 h-4.5 rounded-full bg-[#131722] border-2 border-indigo-500/50 flex items-center justify-center text-[8px]">
                        🔹
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-200">
                            {log.action === 'CREATE_ORDER' ? '🎉 Tạo đơn hàng' :
                             log.action === 'EDIT_ORDER' || log.action === 'UPDATE_ORDER' || log.action === 'PUT_ORDER' ? '✏️ Cập nhật thông tin' :
                             log.action === 'WARRANTY_ORDER' ? '🛠 Báo sự cố lỗi' :
                             log.action === 'RESOLVE_WARRANTY' ? '✅ Xử lý xong bảo hành' :
                             log.action === 'PENDING_REFUND_ORDER' ? '🟠 Chờ hoàn tiền' :
                             log.action === 'REFUND_ORDER' ? '⚫ Hoàn tiền' : log.action}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {logDate.toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{log.details}</p>
                        <div className="text-[10px] text-slate-500">
                          Thực hiện bởi: <strong className="text-slate-400">{log.user?.name || 'Hệ thống'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 italic">Chưa ghi nhận hoạt động nào cho đơn hàng này.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer info, financials, sources */}
        <div className="space-y-6">
          {/* Customer CRM info card */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <User className="w-5 h-5 text-indigo-400" />
              1. Khách hàng liên hệ
            </h3>

            <div className="flex items-center gap-3 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
                {order.customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{order.customer.name}</p>
                <p className="text-[10px] text-slate-500 font-mono">ID: {order.customer.id}</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-slate-500" />
                <span className="text-slate-300 font-mono">{order.customer.phone || 'Không có SĐT'}</span>
              </div>
              {order.customer.facebook && (
                <div className="flex items-center gap-3">
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  <a
                    href={order.customer.facebook.startsWith('http') ? order.customer.facebook : `https://${order.customer.facebook}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sky-400 hover:underline truncate max-w-[180px]"
                  >
                    Facebook
                  </a>
                </div>
              )}
              {order.customer.telegram && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-slate-500" />
                  <a
                    href={`https://t.me/${order.customer.telegram.replace('@', '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    {order.customer.telegram}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Supplier source */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4 text-xs">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <Warehouse className="w-5 h-5 text-indigo-400" />
              4. Nguồn cung cấp hàng
            </h3>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400">Nguồn sỉ nhập:</span>
              <span className="text-white font-bold">{order.supplierSourceName || 'Nhập thủ công / Trực tiếp'}</span>
            </div>
          </div>

          {/* Financials details */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4 text-xs">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              5. Thông tin doanh thu tài chính
            </h3>

            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Giá bán khách hàng:</span>
                <span className="text-emerald-400 font-bold text-sm">{formatCurrency(order.salePrice)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Giá vốn nhập sỉ:</span>
                <span className="text-slate-400 font-bold">{formatCurrency(order.costPrice)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Lợi nhuận ban đầu:</span>
                <span className="text-white font-bold">{formatCurrency(order.salePrice - order.costPrice)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500 text-xs">Lợi nhuận thực tế sau hoàn:</span>
                <span className={`font-extrabold flex items-center gap-1 text-sm ${order.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  {order.profit >= 0 ? '+' : ''}{formatCurrency(order.profit)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-500">Trạng thái lãi/lỗ:</span>
                {order.profit > 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 Lãi</span>
                ) : order.profit === 0 ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 Hòa</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">🔴 Lỗ</span>
                )}
              </div>
            </div>
          </div>

          {/* Payment tracking (#72) */}
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4 text-xs">
            <h3 className="text-base font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              Thông tin thanh toán
            </h3>

            <div className="space-y-3 font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Trạng thái:</span>
                <select
                  value={order.paymentStatus}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    await handleUpdatePaymentStatus(newStatus);
                  }}
                  className={`px-2 py-1 text-[10px] font-bold rounded-lg border bg-[#0f1320] focus:outline-none cursor-pointer ${
                    order.paymentStatus === 'PAID'
                      ? 'text-emerald-400 border-emerald-500/30'
                      : order.paymentStatus === 'OVERDUE'
                      ? 'text-rose-400 border-rose-500/30'
                      : 'text-amber-400 border-amber-500/30'
                  }`}
                >
                  <option value="UNPAID" className="text-amber-400">🟡 Chưa thanh toán</option>
                  <option value="PAID" className="text-emerald-400">🟢 Đã thanh toán</option>
                  <option value="OVERDUE" className="text-rose-400">🔴 Quá hạn</option>
                </select>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Đã thanh toán:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-slate-500">Còn nợ:</span>
                <span className="text-rose-400 font-bold">{formatCurrency(Math.max(0, order.salePrice - order.paidAmount))}</span>
              </div>
              {order.paymentDueDate && (
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-slate-500">Hạn thanh toán:</span>
                  <span className="text-slate-300 font-bold">{new Date(order.paymentDueDate).toLocaleDateString('vi-VN')}</span>
                </div>
              )}
              {order.paidAt && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Ngày thanh toán:</span>
                  <span className="text-slate-300 font-bold">{new Date(order.paidAt).toLocaleDateString('vi-VN')}</span>
                </div>
              )}
            </div>
            {order.paymentStatus !== 'PAID' && (
              <div className="pt-2 border-t border-white/5">
                <Link
                  href={`/admin/debts/${order.customerId}`}
                  className="block w-full py-2 text-center text-xs text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl border border-indigo-500/20 transition-all font-bold"
                >
                  💳 Đi tới Quản lý Công nợ khách
                </Link>
              </div>
            )}
          </div>

          {/* Refund History Records */}
          {order.refundHistories.length > 0 && (
            <div className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4 text-xs">
              <h3 className="text-base font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                <DollarSign className="w-5 h-5 text-rose-400" />
                Lịch sử hoàn tiền
              </h3>
              <div className="space-y-3.5 divide-y divide-white/5">
                {order.refundHistories.map((rh, index) => (
                  <div key={rh.id} className={`space-y-1.5 ${index > 0 ? 'pt-3.5' : ''}`}>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold">Ngày lỗi:</span>
                      <strong className="text-rose-400 text-xs font-bold font-mono">
                        {rh.errorDate ? new Date(rh.errorDate).toLocaleDateString('vi-VN') : '—'}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Dùng: {rh.daysUsed} ngày</span>
                      <span>Còn: {rh.daysRemaining} ngày</span>
                    </div>

                    {/* Detailed breakdown block */}
                    <div className="mt-3 grid grid-cols-2 gap-3 pt-3 border-t border-white/5 font-mono">
                      <div className="space-y-1.5 p-2 rounded-lg bg-white/2 border border-white/5">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">👤 KHÁCH HÀNG</span>
                        <div className="space-y-1 text-[10px] text-slate-400">
                          <div className="flex justify-between"><span>Giá bán:</span> <span className="text-white">{formatCurrency(order.salePrice)}</span></div>
                          <div className="flex justify-between"><span>Giá/ngày:</span> <span className="text-white">{formatCurrency(rh.costPerDay)}</span></div>
                          <div className="flex justify-between font-semibold text-emerald-400 border-t border-white/5 pt-1 mt-1">
                            <span>Hoàn trả:</span> <span>{formatCurrency(rh.amount)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5 p-2 rounded-lg bg-white/2 border border-white/5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider block">🏢 NGUỒN HÀNG</span>
                        <div className="space-y-1 text-[10px] text-slate-400">
                          <div className="flex justify-between"><span>Giá vốn:</span> <span className="text-white">{formatCurrency(order.costPrice)}</span></div>
                          <div className="flex justify-between"><span>Vốn/ngày:</span> <span className="text-white">{formatCurrency(order.costPrice / (order.durationDays || 30))}</span></div>
                          <div className="flex justify-between text-indigo-400 border-t border-white/5 pt-1 mt-1">
                            <span>Dự kiến:</span> <span>{formatCurrency(rh.sourceRefundExpected ?? Math.round((order.costPrice / (order.durationDays || 30)) * rh.daysRemaining))}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-purple-400">
                            <span>Thực tế:</span> <span>{formatCurrency(rh.sourceRefundActual ?? rh.sourceAmount ?? 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 pt-1.5">
                      <span>Người duyệt: {rh.operatorName || 'Hệ thống'}</span>
                      <span>Ngày duyệt: {new Date(rh.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>

                    {rh.note && (
                      <p className="text-[11px] text-slate-400 bg-white/2 p-2 rounded border border-white/5 mt-1.5 leading-relaxed italic">
                        Lý do: {rh.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in my-8 max-h-[95vh] flex flex-col">
            <button onClick={() => setEditModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-lg font-bold text-white mb-4">Chỉnh sửa đơn hàng</h2>

            <form onSubmit={handleEditSubmit} className="space-y-5 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Dịch vụ</label>
                  <select value={editServiceId} onChange={(e) => setEditServiceId(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white select-none">
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tên gói</label>
                  <input type="text" value={editPackageName} onChange={(e) => setEditPackageName(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Số ngày gói</label>
                  <select
                    value={editDurationDays || '30'}
                    onChange={(e) => {
                      setEditDurationDays(e.target.value);
                      setEditPackageName(`Gói ${e.target.value} ngày`);
                    }}
                    required
                    className="w-full px-3 py-2 rounded bg-[#131722] border border-white/10 text-white"
                  >
                    <option value="30">30 ngày</option>
                    <option value="60">60 ngày</option>
                    <option value="90">90 ngày</option>
                    <option value="180">180 ngày</option>
                    <option value="365">365 ngày</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Email tài khoản</label>
                  <input type="text" value={editAccountEmail} onChange={(e) => setEditAccountEmail(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Mật khẩu</label>
                  <input type="text" value={editAccountPassword} onChange={(e) => setEditAccountPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Mã khôi phục (2FA)</label>
                  <input type="text" value={editRecoveryCode} onChange={(e) => setEditRecoveryCode(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Link đăng nhập</label>
                  <input type="text" value={editLoginLink} onChange={(e) => setEditLoginLink(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Hướng dẫn tài khoản</label>
                <input type="text" value={editAccountNote} onChange={(e) => setEditAccountNote(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nguồn hàng</label>
                  <select value={editSupplierSourceId} onChange={(e) => setEditSupplierSourceId(e.target.value)} className="w-full px-3 py-2 rounded bg-[#1a1f2e] border border-white/10 text-white">
                    <option value="">-- Không liên kết nguồn --</option>
                    {supplierSources.map(src => <option key={src.id} value={src.id}>{src.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá bán (₫)</label>
                  <input type="number" value={editSalePrice} onChange={(e) => setEditSalePrice(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá vốn (₫)</label>
                  <input type="number" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
              </div>

              {(editSalePrice !== order.salePrice.toString() || editCostPrice !== order.costPrice.toString()) && (
                <div>
                  <label className="block text-amber-400 mb-1 font-semibold">⚠️ Lý do thay đổi giá trị tài chính *</label>
                  <input
                    type="text"
                    value={priceChangeReason}
                    onChange={(e) => setPriceChangeReason(e.target.value)}
                    required
                    placeholder="Ví dụ: Giảm giá đặc biệt cho khách, nhập sỉ giá tốt hơn..."
                    className="w-full px-3 py-2 rounded bg-amber-500/5 border border-amber-500/25 text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Ngày bắt đầu</label>
                  <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Ngày hết hạn</label>
                  <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Trạng thái</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} required className="w-full px-3 py-2 rounded bg-[#1a1f2e] border border-white/10 text-white">
                    <option value="ACTIVE">🟢 Đang sử dụng</option>
                    <option value="EXPIRING_SOON">🟡 Sắp hết hạn</option>
                    <option value="EXPIRED">🔴 Hết hạn</option>
                    <option value="WARRANTY">🔵 Khách báo lỗi</option>
                    <option value="WARRANTY_PENDING_SOURCE">🟣 Chờ nguồn hoàn</option>
                    <option value="WARRANTY_PENDING_REFUND">🟠 Chờ hoàn khách</option>
                    <option value="WARRANTY_DONE">✅ Hoàn tất bảo hành</option>
                    <option value="WARRANTY_REJECTED">⛔ Từ chối bảo hành</option>
                    <option value="REFUNDED">⚫ Đã hoàn tiền (legacy)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ghi chú nội bộ đơn hàng</label>
                <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white resize-none" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5 flex-shrink-0">
                <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW MODAL */}
      {renewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-xs">
            <button onClick={() => setRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Gia hạn đơn hàng {order.orderCode}</h2>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Số ngày gia hạn thêm *</label>
                <select
                  value={renewDays || '30'}
                  onChange={(e) => setRenewDays(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-[#131722] border border-white/10 text-white"
                >
                  <option value="30">30 ngày</option>
                  <option value="60">60 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">365 ngày</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Doanh thu tăng thêm (₫) *</label>
                  <input type="number" value={renewSalePrice} onChange={(e) => setRenewSalePrice(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá vốn tăng thêm (₫) *</label>
                  <input type="number" value={renewCostPrice} onChange={(e) => setRenewCostPrice(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lưu ý gia hạn (Không bắt buộc)</label>
                <input type="text" value={renewNote} onChange={(e) => setRenewNote(e.target.value)} placeholder="Ví dụ: Khách gia hạn thêm 1 tháng qua Zalo" className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRenewModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REFUND MODAL */}
      {refundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white text-xs">
            <button onClick={() => setRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            
            <div className="text-center space-y-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Xử lý Hoàn tiền Đơn hàng</h2>
                <p className="text-xs text-slate-400 mt-1">Hệ thống tự động tính toán số tiền hoàn pro-rata theo ngày lỗi thực tế.</p>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              {/* Structured Refund Display */}
              <div className="space-y-3.5">
                {/* THÔNG TIN ĐƠN */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">1. Thông tin đơn hàng</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                    <div><span className="text-slate-500">Mã đơn:</span> <strong className="text-white">{order.orderCode}</strong></div>
                    <div><span className="text-slate-500">Khách hàng:</span> <strong className="text-white">{order.customer.name}</strong></div>
                    <div><span className="text-slate-500">Dịch vụ:</span> <strong className="text-white">{order.service.name}</strong></div>
                    <div><span className="text-slate-500">Nguồn hàng:</span> <strong className="text-white">{order.supplierSourceName || '—'}</strong></div>
                  </div>
                </div>

                {/* THÔNG TIN THỜI GIAN */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">2. Thông tin thời gian</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                    <div><span className="text-slate-500">Ngày mua:</span> <strong className="text-white">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày bắt đầu:</span> <strong className="text-white">{new Date(order.startDate).toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày lỗi:</span> <strong className="text-white">{refundErrorDate}</strong></div>
                    <div><span className="text-slate-500">Ngày hoàn:</span> <strong className="text-white">{new Date().toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày hết hạn:</span> <strong className="text-white">{new Date(order.endDate).toLocaleDateString('vi-VN')}</strong></div>
                  </div>
                </div>

                {/* THÔNG TIN TÀI CHÍNH */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">3. Thông tin tài chính ban đầu</h4>
                  <div className="grid grid-cols-3 gap-2 text-[11px] leading-relaxed font-mono">
                    <div><span className="text-slate-500 block">Giá bán:</span> <strong className="text-emerald-400">{formatCurrency(order.salePrice)}</strong></div>
                    <div><span className="text-slate-500 block">Giá vốn:</span> <strong className="text-slate-400">{formatCurrency(order.costPrice)}</strong></div>
                    <div><span className="text-slate-500 block">Lợi nhuận đầu:</span> <strong className="text-indigo-300">{formatCurrency(order.salePrice - order.costPrice)}</strong></div>
                  </div>
                </div>

                {/* TÍNH TOÁN */}
                <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2 text-[11px]">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">4. Tính toán hoàn tiền pro-rata theo ngày lỗi</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pb-2 border-b border-white/5 font-semibold">
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Số ngày sử dụng gói:</span>
                      <span className="text-white font-semibold">{totalDays} ngày</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Thời gian đã dùng:</span>
                      <span className="text-white font-semibold">{refundCalculation.daysUsed} ngày</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Thời gian còn lại:</span>
                      <span className="text-indigo-300 font-bold">{refundCalculation.daysRemaining} ngày</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
                    <div className="space-y-1 p-2 rounded bg-white/2 border border-white/5">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">👤 HOÀN KHÁCH HÀNG</span>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Giá/ngày:</span>
                        <span>{formatCurrency(refundCalculation.costPerDay)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-emerald-400 mt-1 border-t border-white/5 pt-1">
                        <span>Dự kiến hoàn:</span>
                        <span>{formatCurrency(refundCalculation.computedAmount)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 p-2 rounded bg-white/2 border border-white/5">
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block">🏢 NGUỒN PHẢI HOÀN</span>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Vốn/ngày:</span>
                        <span>{formatCurrency(refundCalculation.supplierCostPerDay)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-purple-400 mt-1 border-t border-white/5 pt-1">
                        <span>Dự kiến hoàn:</span>
                        <span>{formatCurrency(refundCalculation.computedSourceRefundExpected)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Net Profit Display */}
                  <div className="mt-3 p-2.5 rounded-lg bg-black/30 border border-white/5 flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400 font-sans">Lợi nhuận ròng sau hoàn:</span>
                    <div>
                      <strong className={`font-bold ${dynamicNetProfit > 0 ? 'text-emerald-400' : dynamicNetProfit < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {formatCurrency(dynamicNetProfit)}
                      </strong>
                      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                        dynamicNetProfit > 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : dynamicNetProfit < 0 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {dynamicNetProfit > 0 ? '🟢 LÃI' : dynamicNetProfit < 0 ? '🔴 LỖ' : '🟡 HOÀ VỐN'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Targets and Overrides inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Trạng thái đích sau hoàn *</label>
                  <select
                    value={refundTargetStatus}
                    onChange={(e) => setRefundTargetStatus(e.target.value as 'PENDING_REFUND' | 'REFUNDED')}
                    required
                    className="w-full px-3 py-2 rounded bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                  >
                    <option value="REFUNDED">⚫ Đã hoàn tiền (Hoàn tất)</option>
                    <option value="PENDING_REFUND">🟠 Chờ hoàn tiền (Chờ chuyển khoản)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Ngày lỗi (pro-rata)*</label>
                  <input
                    type="date"
                    value={refundErrorDate}
                    onChange={(e) => setRefundErrorDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="overrideSourceRefund"
                  checked={overrideSourceRefund}
                  onChange={(e) => {
                    setOverrideSourceRefund(e.target.checked);
                    if (!e.target.checked) {
                      setRefundOverrideSourceRefundActual('');
                    }
                  }}
                  className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#131722] cursor-pointer"
                />
                <label htmlFor="overrideSourceRefund" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                  Nguồn hoàn khác dự kiến
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Số tiền hoàn khách (để trống nếu tự tính)</label>
                  <input
                    type="number"
                    value={refundOverrideAmount}
                    onChange={(e) => setRefundOverrideAmount(e.target.value)}
                    placeholder={`Ví dụ: ${refundCalculation.computedAmount}`}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nguồn hoàn thực tế</label>
                  <input
                    type="number"
                    disabled={!overrideSourceRefund}
                    value={overrideSourceRefund ? refundOverrideSourceRefundActual : ''}
                    onChange={(e) => setRefundOverrideSourceRefundActual(e.target.value)}
                    placeholder={refundCalculation.computedSourceRefundExpected.toString()}
                    className={`w-full px-3 py-2 rounded bg-white/5 border text-white focus:outline-none font-mono transition-all ${
                      !overrideSourceRefund ? 'opacity-40 border-white/5 bg-slate-900/10 cursor-not-allowed' : 'border-white/10 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lý do hoàn tiền *</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Nhập lý do hoàn tiền (bắt buộc)..."
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-[10px] text-yellow-400 leading-relaxed">
                ℹ️ Lưu ý: Bạn cần chuyển khoản giao dịch hoàn tiền thực tế cho khách qua ví/ngân hàng, hệ thống chỉ lưu nhật ký và hạch toán lợi nhuận.
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRefundModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận hoàn tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WARRANTY MODAL */}
      {warrantyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-xs text-white">
            <button onClick={() => setWarrantyModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Báo lỗi tài khoản đơn {order.orderCode}</h2>

            <form onSubmit={handleWarrantySubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ngày xảy ra lỗi *</label>
                <input
                  type="date"
                  value={warrantyErrorDate}
                  onChange={(e) => setWarrantyErrorDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lý do báo lỗi (Không bắt buộc)</label>
                <input
                  type="text"
                  value={warrantyReason}
                  onChange={(e) => setWarrantyReason(e.target.value)}
                  placeholder="Ví dụ: Tài khoản bị lỗi 2FA, mất gói premium,..."
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ghi chú chi tiết thêm (Không bắt buộc)</label>
                <textarea
                  value={warrantyNote}
                  onChange={(e) => setWarrantyNote(e.target.value)}
                  placeholder="Ví dụ: Đã gửi mã khôi phục cho khách..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setWarrantyModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 font-semibold text-center">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Báo lỗi (Bảo hành)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE WARRANTY MODAL */}
      {resolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-xs text-white">
            <button onClick={() => setResolveModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Xử lý xong bảo hành đơn {order.orderCode}</h2>

            <form onSubmit={handleResolveWarrantySubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ghi chú xử lý bảo hành (Không bắt buộc)</label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Ví dụ: Đã đổi tài khoản Canva mới, hoặc gia hạn thêm gói..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setResolveModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 font-semibold text-center font-semibold text-center">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận xử lý xong
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
