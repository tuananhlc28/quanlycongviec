'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, MessageCircle, Edit2, Calendar, RefreshCcw, ShieldAlert,
  Loader2, X, Plus, Clock, CheckCircle2, User, Key, Mail, AlertTriangle, FileText, Check, Copy, Eye, EyeOff,
  DollarSign, TrendingUp, Warehouse, Info, Shield, HelpCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, formatDateShort, getStatusColor, getStatusLabel, getPaymentStatusColor, getPaymentStatusLabel, getCustomerTagConfig, getCreditRatingConfig, calculateDetailedCreditRating, getCustomerWarnings } from '@/lib/utils';
import CountdownBadge from '@/components/shared/CountdownBadge';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

interface CustomerDetailViewProps {
  customer: any;
  services: any[];
  supplierSources: any[];
  activityLogs: any[];
}

export default function CustomerDetailView({
  customer: initialCustomer,
  services,
  supplierSources,
  activityLogs,
}: CustomerDetailViewProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Edit Customer Modal States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || '');
  const [facebook, setFacebook] = useState(customer.facebook || '');
  const [telegram, setTelegram] = useState(customer.telegram || '');
  const [zalo, setZalo] = useState(customer.zalo || '');
  const [note, setNote] = useState(customer.note || '');
  const [tag, setTag] = useState(customer.tag || 'NEW');
  const [status, setStatus] = useState(customer.status || 'ACTIVE');

  // Tab State
  const [activeTab, setActiveTab] = useState<'orders' | 'accounts' | 'warranty' | 'timeline'>('orders');

  // Individual Order actions modals
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [renewDays, setRenewDays] = useState('30');
  const [renewSalePrice, setRenewSalePrice] = useState('');
  const [renewCostPrice, setRenewCostPrice] = useState('');
  const [renewNote, setRenewNote] = useState('');

  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [warrantyErrorDate, setWarrantyErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [warrantyNote, setWarrantyNote] = useState('');

  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');

  // Refund Modal States
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundErrorDate, setRefundErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundReason, setRefundReason] = useState('');
  const [refundOverrideAmount, setRefundOverrideAmount] = useState('');
  const [refundOverrideSourceRefundActual, setRefundOverrideSourceRefundActual] = useState('');
  const [overrideSourceRefund, setOverrideSourceRefund] = useState(false);
  const [refundTargetStatus, setRefundTargetStatus] = useState<'PENDING_REFUND' | 'REFUNDED'>('REFUNDED');

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const togglePasswordVisibility = (orderId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Separation of single/double click credentials copy
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

  // 1. Calculate dynamic statistics
  const stats = useMemo(() => {
    const now = new Date();
    let totalSpent = 0;
    let totalRefund = 0;
    let totalProfit = 0;
    let currentDebt = 0;

    let paidOnTimeCount = 0;
    let latePaymentCount = 0;
    let overdueCount = 0;
    let maxDaysLate = 0;
    let totalDaysLateForLatePayments = 0;

    let activeAccountsCount = 0;
    let warrantyAccountsCount = 0;
    let expiringSoonCount = 0;
    let warrantyCount = 0;

    for (const o of customer.orders) {
      totalSpent += o.salePrice;
      
      const orderRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + r.amount, 0) : 0;
      const orderSourceRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0) : 0;
      
      totalProfit += (o.salePrice - o.costPrice) - orderRefunds + orderSourceRefunds;
      totalRefund += orderRefunds;
      
      warrantyCount += o.refundHistories ? o.refundHistories.length : 0;

      if (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'OVERDUE') {
        currentDebt += Math.max(0, o.salePrice - o.paidAmount);
      }

      // Calculate Payment Timeliness stats
      if (o.paymentStatus === 'PAID') {
        if (o.paymentDueDate && o.paidAt) {
          const dueDate = new Date(o.paymentDueDate);
          const paidDate = new Date(o.paidAt);
          if (paidDate <= dueDate) {
            paidOnTimeCount++;
          } else {
            latePaymentCount++;
            const diffMs = paidDate.getTime() - dueDate.getTime();
            const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
            if (diffDays > maxDaysLate) {
              maxDaysLate = diffDays;
            }
            totalDaysLateForLatePayments += diffDays;
          }
        } else {
          paidOnTimeCount++; // Assume on-time if no due date
        }
      } else {
        // Unpaid or Overdue
        if (o.paymentDueDate && now > new Date(o.paymentDueDate)) {
          overdueCount++;
        }
      }

      // Subscription status counts
      const isActive = ['ACTIVE', 'EXPIRING_SOON', 'WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(o.status);
      if (isActive) {
        activeAccountsCount++;
      }

      const isInWarranty = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(o.status);
      if (isInWarranty) {
        warrantyAccountsCount++;
      }

      const diff = new Date(o.endDate).getTime() - now.getTime();
      const remainingDays = Math.ceil(diff / (24 * 60 * 60 * 1000));
      const isExpiringSoon = o.status === 'EXPIRING_SOON' || (remainingDays >= 0 && remainingDays <= 7 && ['ACTIVE', 'EXPIRING_SOON'].includes(o.status));
      if (isExpiringSoon) {
        expiringSoonCount++;
      }
    }

    const avgDaysLate = latePaymentCount > 0 ? Math.round(totalDaysLateForLatePayments / latePaymentCount) : 0;
    const renewalsCount = activityLogs.filter((log: any) => ['RENEW_ORDER', 'BATCH_RENEW', 'RENEW'].includes(log.action)).length;

    // 3. Formula for credit rating score (0 - 100)
    let score = 0;
    if (customer.orders.length > 0) {
      const breakdown = calculateDetailedCreditRating({
        totalOrders: customer.orders.length,
        paidOnTimeCount,
        latePaymentCount,
        currentDebtCount: overdueCount,
        totalSpend: totalSpent,
        warrantyCount,
        totalRefund,
      });
      score = breakdown.score;
    }

    const warnings = getCustomerWarnings({
      totalOrders: customer.orders.length,
      warrantyCount,
      totalSpend: totalSpent,
      totalRefund,
      note: customer.note,
    });

    return {
      totalOrders: customer.orders.length,
      totalSpent,
      totalRefund,
      totalProfit,
      currentDebt,
      paidOnTimeCount,
      latePaymentCount,
      overdueCount,
      maxDaysLate,
      avgDaysLate,
      activeAccountsCount,
      warrantyAccountsCount,
      expiringSoonCount,
      warrantyCount,
      renewalsCount,
      creditScore: score,
      warnings,
    };
  }, [customer.orders, customer.createdAt, activityLogs, customer.note]);

  const tagCfg = getCustomerTagConfig(customer.tag || 'NEW');
  const ratingCfg = getCreditRatingConfig(customer.creditRating || 'B');

  // 2. Generate monthly purchase trend data for Recharts
  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth() + 1;
      const monthStr = `${monthNum}/${year}`;

      let revenue = 0;
      let profit = 0;
      let refunds = 0;

      for (const o of customer.orders) {
        const orderDate = new Date(o.createdAt);
        if (orderDate.getFullYear() === year && orderDate.getMonth() === d.getMonth()) {
          revenue += o.salePrice;
          const orderRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + r.amount, 0) : 0;
          const orderSourceRefunds = o.refundHistories ? o.refundHistories.reduce((sum: number, r: any) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0) : 0;
          profit += (o.salePrice - o.costPrice) - orderRefunds + orderSourceRefunds;
          refunds += orderRefunds;
        }
      }

      data.push({
        month: monthStr,
        revenue,
        profit,
        refunds,
      });
    }
    return data;
  }, [customer.orders]);

  // 3. Consolidated chronological activity feed
  const timelineEvents = useMemo(() => {
    const events: any[] = [];

    // Customer creation
    events.push({
      date: new Date(customer.createdAt),
      title: '👤 Đăng ký khách hàng',
      description: `Khởi tạo hồ sơ khách hàng ${customer.name} trên CRM.`,
      icon: '🏁',
      color: 'text-indigo-400 bg-indigo-500/10',
    });

    // Orders and warranties
    customer.orders.forEach((o: any) => {
      events.push({
        date: new Date(o.createdAt),
        title: `🛒 Mua gói ${o.packageName}`,
        description: `Đặt mua dịch vụ ${o.service?.name || ''} (${o.packageName}) · Mã đơn: ${o.orderCode} · Giá bán: ${formatCurrency(o.salePrice)} · Tài khoản: ${o.accountEmail || '—'}`,
        icon: '🛒',
        color: 'text-emerald-400 bg-emerald-500/10',
      });

      if (o.refundHistories) {
        o.refundHistories.forEach((r: any) => {
          if (r.errorDate) {
            events.push({
              date: new Date(r.errorDate),
              title: `🛠️ Báo sự cố dịch vụ`,
              description: `Khách báo lỗi cho đơn ${o.orderCode} (${o.packageName}). Ghi chú: ${r.note || 'Không có ghi chú'}`,
              icon: '🛠️',
              color: 'text-rose-400 bg-rose-500/10',
            });
          }
          events.push({
            date: new Date(r.createdAt),
            title: `💸 Hoàn tiền / Xử lý bảo hành`,
            description: `Hoàn tất xử lý bảo hành cho đơn ${o.orderCode}. Đã hoàn khách: -${formatCurrency(r.amount)}. Nguồn hoàn thực tế: +${formatCurrency(r.sourceRefundActual ?? r.sourceAmount ?? 0)}.`,
            icon: '💸',
            color: 'text-amber-400 bg-amber-500/10',
          });
        });
      }
    });

    // Payment records
    if (customer.paymentRecords) {
      customer.paymentRecords.forEach((pr: any) => {
        events.push({
          date: new Date(pr.paidAt),
          title: `💳 Thanh toán thực tế`,
          description: `Nhận thanh toán số tiền ${formatCurrency(pr.amount)} qua phương thức ${pr.method || 'N/A'}. Ghi chú: ${pr.note || 'Không có'}`,
          icon: '💳',
          color: 'text-emerald-400 bg-emerald-500/10',
        });
      });
    }

    // Custom activity logs
    activityLogs.forEach((log: any) => {
      if (['CREATE_ORDER', 'WARRANTY_ORDER', 'REFUND_ORDER'].includes(log.action)) {
        return;
      }
      events.push({
        date: new Date(log.createdAt),
        title: `📝 Ghi nhận hoạt động`,
        description: log.details || '',
        icon: '📝',
        color: 'text-slate-400 bg-slate-500/10',
      });
    });

    // Sort events descending
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [customer, activityLogs]);

  // Submit Edit Customer Details
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tên khách hàng không được để trống');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, facebook, telegram, zalo, note, tag, status }),
      });

      if (res.ok) {
        const updated = await res.json();
        setCustomer((prev: any) => ({ ...prev, ...updated }));
        toast.success('Cập nhật thông tin khách hàng thành công!');
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

  // Submit Renew Action
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    const days = parseInt(renewDays);
    if (isNaN(days) || days < 1) {
      toast.error('Vui lòng nhập số ngày hợp lệ');
      return;
    }

    setLoading(true);
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
        toast.success('Gia hạn dịch vụ thành công!');
        setRenewModalOpen(false);
        // Refresh customer details to pull new orders list
        const updatedCustRes = await fetch(`/api/admin/customers/${customer.id}`);
        if (updatedCustRes.ok) {
          const updatedCust = await updatedCustRes.json();
          setCustomer(updatedCust);
        }
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gia hạn thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  // Submit Warranty / Error Report
  const handleWarrantySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!warrantyReason.trim()) {
      toast.error('Vui lòng nhập lý do báo lỗi');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/warranty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: warrantyErrorDate,
          reason: warrantyReason,
          note: warrantyNote,
        }),
      });

      if (res.ok) {
        toast.success('Báo sự cố bảo hành thành công!');
        setWarrantyModalOpen(false);
        const updatedCustRes = await fetch(`/api/admin/customers/${customer.id}`);
        if (updatedCustRes.ok) {
          const updatedCust = await updatedCustRes.json();
          setCustomer(updatedCust);
        }
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Báo sự cố thất bại');
      }
    } catch {
      toast.error('Lỗi mạng');
    } finally {
      setLoading(false);
    }
  };

  // Submit Change Source
  const handleChangeSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!sourceId) {
      toast.error('Vui lòng chọn nguồn hàng');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierSourceId: sourceId,
        }),
      });

      if (res.ok) {
        toast.success('Đổi nguồn hàng thành công!');
        setSourceModalOpen(false);
        const updatedCustRes = await fetch(`/api/admin/customers/${customer.id}`);
        if (updatedCustRes.ok) {
          const updatedCust = await updatedCustRes.json();
          setCustomer(updatedCust);
        }
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Đổi nguồn thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  // Submit Refund Modal
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      toast.error('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: refundErrorDate,
          reason: refundReason,
          overrideAmount: refundOverrideAmount || undefined,
          overrideSourceRefundActual: overrideSourceRefund ? refundOverrideSourceRefundActual : undefined,
          targetStatus: refundTargetStatus,
        }),
      });

      if (res.ok) {
        toast.success('Xử lý hoàn tiền thành công!');
        setRefundModalOpen(false);
        const updatedCustRes = await fetch(`/api/admin/customers/${customer.id}`);
        if (updatedCustRes.ok) {
          const updatedCust = await updatedCustRes.json();
          setCustomer(updatedCust);
        }
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

  const openRenewModal = (order: any) => {
    setSelectedOrder(order);
    setRenewDays('30');
    setRenewSalePrice(order.salePrice.toString());
    setRenewCostPrice(order.costPrice.toString());
    setRenewNote('');
    setRenewModalOpen(true);
  };

  const openWarrantyModal = (order: any) => {
    setSelectedOrder(order);
    setWarrantyErrorDate(new Date().toISOString().split('T')[0]);
    setWarrantyReason('');
    setWarrantyNote('');
    setWarrantyModalOpen(true);
  };

  const openSourceModal = (order: any) => {
    setSelectedOrder(order);
    setSourceId(order.supplierSourceId || '');
    setSourceModalOpen(true);
  };

  const openRefundModal = (order: any) => {
    setSelectedOrder(order);
    setRefundErrorDate(new Date().toISOString().split('T')[0]);
    setRefundReason('');
    setRefundOverrideAmount('');
    setRefundOverrideSourceRefundActual('');
    setOverrideSourceRefund(false);
    setRefundTargetStatus('REFUNDED');
    setRefundModalOpen(true);
  };

  // Refund calculations pro-rata
  const refundCalculation = useMemo(() => {
    if (!selectedOrder) return { daysUsed: 0, daysRemaining: 0, costPerDay: 0, computedAmount: 0, supplierCostPerDay: 0, computedSourceRefundExpected: 0 };
    const start = new Date(selectedOrder.startDate);
    const totalDays = selectedOrder.durationDays || 30;
    const errorDateObj = refundErrorDate ? new Date(refundErrorDate) : new Date();
    
    const diff = errorDateObj.getTime() - start.getTime();
    let computedDaysUsed = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (computedDaysUsed < 0) computedDaysUsed = 0;
    if (computedDaysUsed > totalDays) computedDaysUsed = totalDays;

    const computedDaysRemaining = totalDays - computedDaysUsed;
    const costPerDay = selectedOrder.salePrice / totalDays;
    const computedRefundAmount = Math.max(0, Math.round(computedDaysRemaining * costPerDay));

    const supplierCostPerDay = selectedOrder.costPrice / totalDays;
    const computedSourceRefundExpected = Math.max(0, Math.round(computedDaysRemaining * supplierCostPerDay));

    return {
      daysUsed: computedDaysUsed,
      daysRemaining: computedDaysRemaining,
      costPerDay,
      computedAmount: computedRefundAmount,
      supplierCostPerDay,
      computedSourceRefundExpected,
    };
  }, [refundErrorDate, selectedOrder]);

  const dynamicNetProfit = useMemo(() => {
    if (!selectedOrder) return 0;
    const sale = selectedOrder.salePrice;
    const cost = selectedOrder.costPrice;
    const clientRefund = refundOverrideAmount !== '' 
      ? (parseFloat(refundOverrideAmount) || 0)
      : refundCalculation.computedAmount;
    const sourceRefund = overrideSourceRefund
      ? (parseFloat(refundOverrideSourceRefundActual) || 0)
      : refundCalculation.computedSourceRefundExpected;
    return sale - cost - clientRefund + sourceRefund;
  }, [selectedOrder, refundOverrideAmount, refundOverrideSourceRefundActual, overrideSourceRefund, refundCalculation]);

  // Aggregate warranty list from order refund histories
  const warrantyHistoryList = useMemo(() => {
    const list: any[] = [];
    for (const order of customer.orders) {
      if (order.refundHistories && order.refundHistories.length > 0) {
        for (const rh of order.refundHistories) {
          list.push({
            ...rh,
            orderCode: order.orderCode,
            service: order.service,
          });
        }
      }
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customer.orders]);

  const hasContact = customer.phone || customer.zalo || customer.facebook || customer.telegram;

  return (
    <div className="space-y-6 text-white animate-fade-in pb-12">
      {/* Header & Back Action */}
      <div className="flex items-center gap-3">
        <Link href="/admin/customers" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            👤 Chi tiết khách hàng
          </h1>
          <p className="text-sm text-slate-400 mt-1">Hồ sơ CRM khách hàng, lịch sử đơn hàng và thống kê thanh toán.</p>
        </div>
      </div>

      {/* Top Profile Grid (Hàng 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Thông tin khách hàng */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 flex flex-col space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-lg border border-indigo-500/20 flex-shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white">{customer.name}</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${tagCfg.color}`}>
                  {tagCfg.emoji} {tagCfg.label}
                </span>
                {stats.warnings && stats.warnings.map((w: string, idx: number) => (
                  <span key={idx} className="inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-sm" title={w}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1 flex-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Ghi chú khách hàng</span>
            <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5 leading-relaxed min-h-[60px] whitespace-pre-line">
              {customer.note || 'Không có ghi chú.'}
            </p>
          </div>
          <button
            onClick={() => setEditModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer h-9"
          >
            <Edit2 className="w-3 h-3" /> Chỉnh sửa thông tin
          </button>
        </div>

        {/* Card 2: Thông tin liên hệ */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin liên hệ</h3>
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> SĐT:</span>
              <span className="text-white font-mono font-medium">{customer.phone || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Zalo:</span>
              <span className="text-white font-mono font-medium">{customer.zalo || customer.phone || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-400 flex items-center gap-1.5">🌐 Telegram:</span>
              <span className="text-white font-mono font-medium">{customer.telegram || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-1">
              <span className="text-slate-400 flex items-center gap-1.5">🌐 Facebook:</span>
              {customer.facebook ? (
                <a
                  href={customer.facebook.startsWith('http') ? customer.facebook : `https://${customer.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline truncate max-w-[120px] font-medium"
                >
                  Link FB
                </a>
              ) : (
                <span className="text-white">—</span>
              )}
            </div>
          </div>

          {hasContact && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Liên hệ nhanh</span>
              <div className="flex flex-wrap gap-1.5">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-semibold border border-emerald-500/20 transition-all h-7">
                    <Phone className="w-3 h-3" /> Gọi
                  </a>
                )}
                {(customer.zalo || customer.phone) && (
                  <a href={`https://zalo.me/${customer.zalo || customer.phone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 text-[11px] font-semibold border border-teal-500/20 transition-all h-7">
                    💬 Zalo
                  </a>
                )}
                {customer.telegram && (
                  <a href={`https://t.me/${customer.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-[11px] font-semibold border border-sky-500/20 transition-all h-7">
                    🌐 Tele
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Điểm uy tín */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 flex flex-col justify-between space-y-4">
          <div className="space-y-3 flex-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Xếp hạng & Điểm uy tín</h3>
            <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Xếp hạng chữ</p>
                <p className={`text-xl font-black mt-0.5 ${ratingCfg.color}`}>{ratingCfg.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Điểm số</p>
                <p className="text-xl font-black text-indigo-400 font-mono mt-0.5">{stats.creditScore} / 100</p>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed space-y-1 pt-1">
              <p>• <strong className="text-emerald-400">A / A+</strong>: Uy tín cao, thanh toán đúng hạn.</p>
              <p>• <strong className="text-amber-400">B</strong>: Trung bình, thỉnh thoảng trễ hạn.</p>
              <p>• <strong className="text-rose-400">C / D</strong>: Rủi ro cao, thường xuyên nợ lâu.</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
            <span className="text-slate-500">Khách hàng từ:</span>
            <span className="text-slate-300 font-mono font-semibold">{formatDateShort(customer.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* SECTION: KPI GRID (Hàng 2 - Tất cả trên cùng 1 hàng) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng chi tiêu</span>
          <span className="text-base font-black text-blue-400 font-mono mt-1.5 block">{formatCurrency(stats.totalSpent)}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh thu</span>
          <span className="text-base font-black text-sky-400 font-mono mt-1.5 block">{formatCurrency(stats.totalSpent - stats.totalRefund)}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lợi nhuận</span>
          <span className="text-base font-black text-emerald-400 font-mono mt-1.5 block">{formatCurrency(stats.totalProfit)}</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng đơn</span>
          <span className="text-base font-black text-white font-mono mt-1.5 block">{stats.totalOrders} đơn</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Gia hạn</span>
          <span className="text-base font-black text-amber-400 font-mono mt-1.5 block">{stats.renewalsCount} lần</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sự cố</span>
          <span className="text-base font-black text-rose-400 font-mono mt-1.5 block">{stats.warrantyCount} lần</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TK đang dùng</span>
          <span className="text-base font-black text-emerald-400 font-mono mt-1.5 block">{stats.activeAccountsCount} TK</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-indigo-500/20 transition-all flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sắp hết hạn</span>
          <span className="text-base font-black text-amber-500 font-mono mt-1.5 block">{stats.expiringSoonCount} TK</span>
        </div>
      </div>

      {/* SECTION: MONTHLY PURCHASE TREND CHART (Full width) */}
      <div className="p-5 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            📈 Xu hướng mua hàng & Lợi nhuận (12 Tháng)
          </h3>
          <p className="text-[10.5px] text-slate-500 mt-1">Biểu đồ chi tiêu, lợi nhuận ròng và hoàn tiền theo từng tháng của khách hàng.</p>
        </div>
        
        {!mounted ? (
          <div className="w-full h-64 rounded-xl bg-white/5 border border-white/5 animate-pulse flex items-center justify-center text-slate-500 text-xs">
            Đang tải biểu đồ...
          </div>
        ) : (
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRefunds" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="rgba(255, 255, 255, 0.4)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.4)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#131722', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                  itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                />
                <Area type="monotone" name="Chi tiêu" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" name="Lợi nhuận" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                <Area type="monotone" name="Hoàn tiền" dataKey="refunds" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorRefunds)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* LOWER GRID: TIMELINESS + REAL PAYMENTS (Full width) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Timeliness */}
        <div className="p-5 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" /> Tính lịch sự thanh toán
          </h4>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-3 bg-white/2 rounded-xl border border-white/5 flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Đúng hạn</p>
              <p className="text-base font-bold text-emerald-400 mt-1">{stats.paidOnTimeCount} lần</p>
            </div>
            <div className="p-3 bg-white/2 rounded-xl border border-white/5 flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Trễ hạn</p>
              <p className="text-base font-bold text-amber-500 mt-1">{stats.latePaymentCount} lần</p>
            </div>
            <div className="p-3 bg-white/2 rounded-xl border border-white/5 flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Quá hạn hiện tại</p>
              <p className="text-base font-bold text-rose-500 mt-1">{stats.overdueCount} đơn</p>
            </div>
            <div className="p-3 bg-white/2 rounded-xl border border-white/5 flex flex-col justify-between">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Trung bình trễ</p>
              <p className="text-base font-bold text-orange-400 mt-1">{stats.avgDaysLate} ngày</p>
            </div>
          </div>
        </div>

        {/* Payment Records Feed */}
        <div className="p-5 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-4 flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" /> Lịch sử thanh toán
          </h4>
          {customer.paymentRecords && customer.paymentRecords.length > 0 ? (
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 flex-1">
              {customer.paymentRecords.slice(0, 5).map((pr: any) => (
                <div key={pr.id} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all text-[11px]">
                  <div>
                    <p className="text-slate-300 font-medium">{pr.order?.orderCode ? `Đơn ${pr.order.orderCode}` : 'Nhiều đơn'}</p>
                    <p className="text-[9px] text-slate-500">{formatDateShort(pr.paidAt)} · {pr.method}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-emerald-400 font-bold">+{formatCurrency(pr.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500 py-6 flex-1 flex items-center justify-center">Chưa có giao dịch thanh toán.</p>
          )}
        </div>
      </div>

          {/* TAB SYSTEM SECTION */}
          <div className="space-y-4">
            <div className="flex border-b border-white/5 flex-wrap">
              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'border-indigo-500 text-indigo-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                📦 Danh sách đơn hàng
              </button>
              <button
                onClick={() => setActiveTab('accounts')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'accounts'
                    ? 'border-emerald-500 text-emerald-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                🔑 Danh sách tài khoản
              </button>
              <button
                onClick={() => setActiveTab('warranty')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'warranty'
                    ? 'border-rose-500 text-rose-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                🛠 Lịch sử bảo hành
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'border-amber-500 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                ⏱️ Timeline hoạt động
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="mt-4">
              
              {/* TAB 1: ORDERS LIST */}
              {activeTab === 'orders' && (
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5 w-12 text-center">STT</th>
                        <th className="px-5 py-3.5">Mã đơn</th>
                        <th className="px-5 py-3.5">Dịch vụ & Gói</th>
                        <th className="px-5 py-3.5">Tài chính</th>
                        <th className="px-5 py-3.5">Thời hạn</th>
                        <th className="px-5 py-3.5">Trạng thái</th>
                        <th className="px-5 py-3.5">Thanh toán</th>
                        <th className="px-5 py-3.5 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {customer.orders.map((o: any, idx: number) => {
                        const diff = new Date(o.endDate).getTime() - new Date().getTime();
                        const remaining = Math.ceil(diff / (24 * 60 * 60 * 1000));

                        return (
                          <tr key={o.id} className="hover:bg-white/2 transition-colors">
                            {/* STT */}
                            <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>

                            {/* Order Code */}
                            <td className="px-5 py-4 font-bold text-indigo-400">
                              <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                                {o.orderCode}
                              </Link>
                            </td>

                            {/* Service Logo & Package */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg">{o.service?.logo || '🔑'}</span>
                                <div>
                                  <p className="font-semibold text-white truncate max-w-[120px]">{o.service?.name}</p>
                                  <p className="text-[10px] text-slate-500 truncate max-w-[120px]">{o.packageName}</p>
                                </div>
                              </div>
                            </td>

                            {/* Financial */}
                            <td className="px-5 py-4 font-mono text-[11px] text-left">
                              <div className="space-y-0.5">
                                <p className="text-emerald-400 font-bold font-mono">Bán: {formatCurrency(o.salePrice)}</p>
                                <p className="text-slate-400 font-mono">Vốn/Gốc: {formatCurrency(o.costPrice)}</p>
                                <p className="text-indigo-300 font-bold font-mono">Lợi nhuận: {formatCurrency(o.profit)}</p>
                                <p className="text-blue-400 font-mono">Đã TT: {formatCurrency(o.paidAmount)}</p>
                                {o.salePrice - o.paidAmount > 0 ? (
                                  <p className="text-rose-400 font-semibold font-mono">Nợ: {formatCurrency(o.salePrice - o.paidAmount)}</p>
                                ) : (
                                  <p className="text-slate-500 font-mono">Nợ: 0đ</p>
                                )}
                                {(() => {
                                  const totalRefund = o.refundHistories?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;
                                  return totalRefund > 0 ? (
                                    <p className="text-rose-500 font-bold border-t border-white/5 pt-0.5 mt-0.5 font-mono">Hoàn: {formatCurrency(totalRefund)}</p>
                                  ) : null;
                                })()}
                              </div>
                            </td>

                            {/* Duration */}
                            <td className="px-5 py-4">
                              <div className="space-y-1 flex flex-col items-start">
                                {(() => {
                                  const latestRefund = o.refundHistories && o.refundHistories.length > 0
                                    ? [...o.refundHistories].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                                    : null;
                                  const errorDateVal = latestRefund ? (latestRefund.errorDate || latestRefund.createdAt) : o.updatedAt;
                                  return (
                                    <CountdownBadge endDate={o.endDate} status={o.status} completedAt={errorDateVal} />
                                  );
                                })()}
                              </div>
                            </td>

                            {/* Order Status */}
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(o.status)}`}>
                                {getStatusLabel(o.status)}
                              </span>
                            </td>

                            {/* Payment Status */}
                            <td className="px-5 py-4">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getPaymentStatusColor(o.paymentStatus)}`}>
                                {getPaymentStatusLabel(o.paymentStatus)}
                              </span>
                            </td>

                            {/* Inline Actions */}
                            <td className="px-5 py-4 text-center">
                              <div className="flex flex-wrap gap-1.5 items-center justify-center max-w-[210px]">
                                <Link
                                  href={`/admin/orders/${o.id}`}
                                  className="btn-compact font-semibold"
                                  title="Xem chi tiết đơn gốc"
                                >
                                  👁️ Xem
                                </Link>
                                {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'].includes(o.status) && (
                                  <>
                                    <button
                                      onClick={() => openRenewModal(o)}
                                      className="btn-compact btn-compact-success font-semibold"
                                      title="Gia hạn"
                                    >
                                      🔄 Gia hạn
                                    </button>
                                    <button
                                      onClick={() => openWarrantyModal(o)}
                                      className="btn-compact btn-compact-danger font-semibold"
                                      title="Báo lỗi bảo hành"
                                    >
                                      🛠 Báo lỗi
                                    </button>
                                    <button
                                      onClick={() => openRefundModal(o)}
                                      className="btn-compact btn-compact-danger font-semibold"
                                      title="Xử lý hoàn tiền cho khách"
                                    >
                                      💸 Hoàn tiền
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => openSourceModal(o)}
                                  className="btn-compact btn-compact-primary font-semibold"
                                  title="Đổi nguồn hàng"
                                >
                                  📦 Nguồn
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {customer.orders.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                            Khách hàng chưa có đơn hàng nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: ACCOUNTS LIST */}
              {activeTab === 'accounts' && (
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5 w-12 text-center">STT</th>
                        <th className="px-5 py-3.5">Dịch vụ</th>
                        <th className="px-5 py-3.5">Email tài khoản</th>
                        <th className="px-5 py-3.5">Mật khẩu</th>
                        <th className="px-5 py-3.5">Ngày hết hạn</th>
                        <th className="px-5 py-3.5">Thời gian còn lại</th>
                        <th className="px-5 py-3.5">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {customer.orders.map((o: any, idx: number) => (
                        <tr key={o.id} className="hover:bg-white/2 transition-colors">
                          <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{o.service?.logo || '🔑'}</span>
                              <div>
                                <p className="font-semibold text-white">{o.service?.name}</p>
                                <p className="text-[10px] text-slate-500">{o.packageName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {o.accountEmail ? (
                              <button
                                onClick={(e) => handleEmailClick(e, o.accountEmail, o.accountPassword || undefined)}
                                className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline block text-left cursor-pointer focus:outline-none select-all font-mono"
                                title="Click 1 lần copy Email, click 2 lần copy Email + Mật khẩu"
                              >
                                {o.accountEmail}
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {o.accountPassword ? (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <span className="font-mono">
                                  {visiblePasswords[o.id] ? o.accountPassword : '••••••••'}
                                </span>
                                <button
                                  onClick={() => togglePasswordVisibility(o.id)}
                                  className="text-slate-600 hover:text-slate-400 cursor-pointer focus:outline-none"
                                >
                                  {visiblePasswords[o.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                            {formatDateShort(o.endDate)}
                          </td>
                          <td className="px-5 py-4">
                             {(() => {
                               const latestRefund = o.refundHistories && o.refundHistories.length > 0
                                 ? [...o.refundHistories].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                                 : null;
                               const errorDateVal = latestRefund ? (latestRefund.errorDate || latestRefund.createdAt) : o.updatedAt;
                               return (
                                 <CountdownBadge endDate={o.endDate} status={o.status} completedAt={errorDateVal} />
                               );
                             })()}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(o.status)}`}>
                              {getStatusLabel(o.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {customer.orders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                            Khách hàng chưa có tài khoản nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: WARRANTY HISTORY */}
              {activeTab === 'warranty' && (
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3.5 w-12 text-center">STT</th>
                        <th className="px-5 py-3.5">Mã đơn & Dịch vụ</th>
                        <th className="px-5 py-3.5">Ngày báo lỗi</th>
                        <th className="px-5 py-3.5">Nội dung lỗi</th>
                        <th className="px-5 py-3.5">Tiền hoàn</th>
                        <th className="px-5 py-3.5">Người xử lý</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                      {warrantyHistoryList.map((rh: any, idx: number) => (
                        <tr key={rh.id} className="hover:bg-white/2 transition-colors">
                          <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="px-5 py-4">
                            <div>
                              <strong className="text-indigo-400 block font-mono">{rh.orderCode}</strong>
                              <div className="flex items-center gap-1 mt-0.5 text-slate-400">
                                <span>{rh.service?.logo || '🔑'}</span>
                                <span className="text-[11px] font-medium">{rh.service?.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                            {rh.errorDate ? formatDateShort(rh.errorDate) : formatDateShort(rh.createdAt)}
                          </td>
                          <td className="px-5 py-4 max-w-[200px] truncate" title={rh.note}>
                            {rh.note || 'Không có lý do/nội dung cụ thể.'}
                          </td>
                          <td className="px-5 py-4 font-mono text-rose-400 font-bold">
                            {formatCurrency(rh.amount)}
                          </td>
                          <td className="px-5 py-4 text-slate-400">
                            {rh.operatorName || 'Hệ thống'}
                          </td>
                        </tr>
                      ))}
                      {warrantyHistoryList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                            Không có lịch sử bảo hành/hoàn tiền nào cho khách hàng này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: ACTIVITY TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="p-5 rounded-2xl bg-[#131722]/50 border border-white/5 space-y-5">
                  <div className="relative border-l-2 border-white/5 ml-4 pl-6 space-y-6">
                    {timelineEvents.map((evt: any, index: number) => (
                      <div key={index} className="relative group">
                        {/* Timeline Bullet */}
                        <div className={`absolute -left-[35px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-[#131722] ${evt.color}`}>
                          {evt.icon}
                        </div>
                        
                        {/* Event Card */}
                        <div className="p-4 rounded-xl bg-white/2 border border-white/5 group-hover:border-white/10 transition-all space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-200">{evt.title}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{formatDate(evt.date)}</span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{evt.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

      {/* --- MODAL: EDIT CUSTOMER DETAILS --- */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white text-xs">
            <button onClick={() => setEditModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Chỉnh sửa thông tin khách hàng</h2>
            
            <form onSubmit={handleEditCustomer} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Họ và tên *</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Số điện thoại</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Zalo</label>
                  <input type="text" value={zalo} onChange={e => setZalo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Telegram</label>
                  <input type="text" value={telegram} onChange={e => setTelegram(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Facebook URL</label>
                  <input type="text" value={facebook} onChange={e => setFacebook(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Tag Phân Loại</label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="NEW">Mới (NEW)</option>
                    <option value="REGULAR">Quen (REGULAR)</option>
                    <option value="VIP">VIP</option>
                    <option value="DAI_LY">Đại lý</option>
                    <option value="SPAM">Spam</option>
                    <option value="KHACH_NO">Khách nợ</option>
                    <option value="THAN_THIET">Thân thiết</option>
                    <option value="INACTIVE_30">30 ngày chưa mua</option>
                    <option value="INACTIVE_60">60 ngày chưa mua</option>
                    <option value="INACTIVE_90">90 ngày chưa mua</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Trạng thái</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">🟢 Hoạt động</option>
                    <option value="LOCKED">🔴 Tạm khóa</option>
                    <option value="VIP">🟣 VIP</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase tracking-wider">Ghi chú riêng</label>
                <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none resize-none" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer transition-all">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INLINE RENEW --- */}
      {renewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-2">Gia hạn dịch vụ</h2>
            <p className="text-slate-400 mb-4">Đơn hàng: <strong className="text-white">{selectedOrder.orderCode}</strong> · Gói: {selectedOrder.packageName}</p>
            
            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase">Số ngày gia hạn *</label>
                <select value={renewDays} onChange={e => setRenewDays(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white">
                  <option value="30">30 ngày</option>
                  <option value="60">60 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">365 ngày</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase">Giá bán gia hạn (₫)</label>
                  <input required type="number" value={renewSalePrice} onChange={e => setRenewSalePrice(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold uppercase">Giá vốn gia hạn (₫)</label>
                  <input required type="number" value={renewCostPrice} onChange={e => setRenewCostPrice(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase">Ghi chú gia hạn</label>
                <input type="text" value={renewNote} onChange={e => setRenewNote(e.target.value)} placeholder="Nhập ghi chú..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRenewModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INLINE WARRANTY --- */}
      {warrantyModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setWarrantyModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-2">Báo sự cố bảo hành</h2>
            <p className="text-slate-400 mb-4">Đơn hàng: <strong className="text-white">{selectedOrder.orderCode}</strong> · Tài khoản: {selectedOrder.accountEmail}</p>
            
            <form onSubmit={handleWarrantySubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase">Lý do lỗi *</label>
                <input required type="text" value={warrantyReason} onChange={e => setWarrantyReason(e.target.value)} placeholder="Ví dụ: Sai mật khẩu, mất premium..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase">Ngày báo lỗi</label>
                <input type="date" value={warrantyErrorDate} onChange={e => setWarrantyErrorDate(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold uppercase">Lưu ý xử lý (Không bắt buộc)</label>
                <textarea rows={2} value={warrantyNote} onChange={e => setWarrantyNote(e.target.value)} placeholder="Ghi chú thêm cho kỹ thuật..." className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white resize-none" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setWarrantyModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Báo lỗi ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INLINE CHANGE SOURCE --- */}
      {sourceModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setSourceModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-2">Thay đổi nguồn cung cấp</h2>
            <p className="text-slate-400 mb-4">Đơn hàng: <strong className="text-white">{selectedOrder.orderCode}</strong> · Nguồn hiện tại: {selectedOrder.supplierSourceName || 'Nguồn trực tiếp'}</p>
            
            <form onSubmit={handleChangeSourceSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Chọn nguồn cung cấp mới *</label>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none">
                  <option value="">-- Nguồn trực tiếp / Không đổi --</option>
                  {supplierSources.map(src => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setSourceModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Cập nhật nguồn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INLINE REFUND (HOÀN TIỀN) --- */}
      {refundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
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
              <div className="space-y-3.5">
                {/* Order Details */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">1. Thông tin đơn hàng</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                    <div><span className="text-slate-500">Mã đơn:</span> <strong className="text-white">{selectedOrder.orderCode}</strong></div>
                    <div><span className="text-slate-500">Dịch vụ:</span> <strong className="text-white">{selectedOrder.service?.name}</strong></div>
                    <div><span className="text-slate-500">Nguồn hàng:</span> <strong className="text-white">{selectedOrder.supplierSourceName || '—'}</strong></div>
                  </div>
                </div>

                {/* Pro-rata computations */}
                <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2 text-[11px]">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">2. Tính toán hoàn tiền pro-rata theo ngày lỗi</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pb-2 border-b border-white/5 font-semibold">
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Số ngày sử dụng gói:</span>
                      <span className="text-white">{selectedOrder.durationDays || 30} ngày</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Thời gian đã dùng:</span>
                      <span className="text-white">{refundCalculation.daysUsed} ngày</span>
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

                  {/* Net profit after refund */}
                  <div className="mt-3 p-2.5 rounded-lg bg-black/30 border border-white/5 flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400 font-sans">Lợi nhuận ròng sau hoàn:</span>
                    <div>
                      <strong className={`font-bold ${dynamicNetProfit > 0 ? 'text-emerald-400' : dynamicNetProfit < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {formatCurrency(dynamicNetProfit)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold font-sans text-[11px]">Tiền hoàn khách (để trống nếu tự tính)</label>
                  <input
                    type="number"
                    value={refundOverrideAmount}
                    onChange={(e) => setRefundOverrideAmount(e.target.value)}
                    placeholder={`Ví dụ: ${refundCalculation.computedAmount}`}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold font-sans text-[11px]">Nguồn hoàn thực tế</label>
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

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRefundModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận hoàn tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
