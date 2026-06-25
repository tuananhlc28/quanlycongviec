'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Clock, User, Shield, Warehouse, DollarSign,
  Loader2, CheckCircle2, XCircle, History, AlertTriangle, ShieldAlert,
  Info, Calendar, CreditCard, Tag
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, formatDateShort, getStatusLabel, getStatusColor, getSourceRefundLabel, getSourceRefundColor, calculateRealProfit } from '@/lib/utils';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { toBlob } from 'html-to-image';

interface WarrantyDetailViewProps {
  order: any;
  activityLogs: any[];
}

export default function WarrantyDetailView({ order, activityLogs }: WarrantyDetailViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

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

  const latestRefund = order.refundHistories?.[0];

  // Days calculations (fallback to date diff if refundHistories is missing)
  const durationDays = order.durationDays || 30;
  const start = new Date(order.startDate);
  const now = new Date();
  
  // Calculate current days used/remaining on-the-fly for reference
  const totalDays = durationDays;
  const diffTime = Math.max(0, now.getTime() - start.getTime());
  const currentDaysUsed = Math.min(totalDays, Math.floor(diffTime / (24 * 60 * 60 * 1000)));
  const currentDaysRemaining = Math.max(0, totalDays - currentDaysUsed);

  // If we have a logged refund record, use its locked snapshot values, else dynamic
  const daysUsed = latestRefund ? latestRefund.daysUsed : currentDaysUsed;
  const daysRemaining = latestRefund ? latestRefund.daysRemaining : currentDaysRemaining;
  const costPerDay = latestRefund ? latestRefund.costPerDay : (order.salePrice / durationDays);
  
  const expectedClientRefund = latestRefund ? latestRefund.autoRefundAmount : Math.round(daysRemaining * costPerDay);
  const expectedSourceRefund = latestRefund ? latestRefund.sourceRefundExpected : Math.round(daysRemaining * (order.costPrice / durationDays));

  // Prefill actuals with defaults: fallback to expected if actual is 0/empty
  const defaultClientRefund = latestRefund 
    ? (latestRefund.amount || latestRefund.autoRefundAmount || 0) 
    : expectedClientRefund;
  const defaultSourceRefund = latestRefund 
    ? (latestRefund.sourceRefundActual || latestRefund.sourceRefundExpected || 0) 
    : expectedSourceRefund;

  // Financial values state
  const [actualClientRefund, setActualClientRefund] = useState(defaultClientRefund.toString());
  const [actualSourceRefund, setActualSourceRefund] = useState(defaultSourceRefund.toString());

  const clientRefundVal = parseFloat(actualClientRefund) || 0;
  const sourceRefundVal = parseFloat(actualSourceRefund) || 0;

  // Real profit calculation
  const realProfit = order.salePrice - order.costPrice - clientRefundVal + sourceRefundVal;

  // Find order creator from activity logs
  const creatorName = useMemo(() => {
    const creatorLog = activityLogs.find(log => 
      log.action.toLowerCase().includes('tạo đơn') || 
      log.action.toLowerCase().includes('create')
    ) || activityLogs[activityLogs.length - 1];
    return creatorLog?.user?.name || 'Hệ thống';
  }, [activityLogs]);

  const debtAmount = order.salePrice - order.paidAmount;
  const hasDebt = debtAmount > 0;

  const handleCopyCardImage = async () => {
    if (!cardRef.current) {
      toast.error('Không tìm thấy template thẻ bảo hành.');
      return;
    }
    setCopying(true);
    const toastId = toast.loading('Đang khởi tạo ảnh bảo hành...');
    try {
      // Small timeout to ensure DOM is ready and styled
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const blob = await toBlob(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0f172a', // Slate 900 background for a crisp render
      });

      if (!blob) {
        throw new Error('Không thể tạo file ảnh từ giao diện.');
      }

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        toast.success('📋 Đã copy ảnh đơn bảo hành vào Clipboard! Nhấn Ctrl+V để dán.', { id: toastId });
      } else {
        throw new Error('Trình duyệt không hỗ trợ Clipboard API ghi ảnh.');
      }
    } catch (error: any) {
      console.error('Lỗi khi copy ảnh bảo hành:', error);
      toast.error(
        `Không hỗ trợ copy ảnh: ${error?.message || 'Trình duyệt chặn quyền truy cập Clipboard'}`,
        { id: toastId }
      );
    } finally {
      setCopying(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/warranty-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          note: statusNote,
          amount: clientRefundVal,
          sourceRefundActual: sourceRefundVal,
        }),
      });
      if (res.ok) {
        toast.success('Cập nhật trạng thái thành công!');
        setStatusNote('');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFinancials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/warranty-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: order.status,
          note: statusNote || 'Cập nhật số tiền bảo hành thủ công',
          amount: clientRefundVal,
          sourceRefundActual: sourceRefundVal,
        }),
      });
      if (res.ok) {
        toast.success('Đã lưu chỉnh sửa số tiền!');
        setStatusNote('');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Lưu thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  // Timeline Step Generator
  const timelineSteps = useMemo(() => {
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
  }, [order, latestRefund]);

  const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
  const statusColor = ORDER_STATUS_COLORS[order.status] || '';

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/warranty" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Xử lý bảo hành {order.orderCode}</h1>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">Nghiệp vụ bảo hành tài khoản lỗi · Tách riêng biệt với công nợ</p>
          </div>
        </div>
      </div>

      {/* Hero Overview: ALL IMPORTANT INFO ON TOP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Panel 1: Order & Customer Details */}
        <div className="p-5 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Thông tin đơn hàng & Khách
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">ID: {order.id.slice(-6)}</span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Khách hàng</p>
              {order.customer?.id ? (
                <Link href={`/admin/customers/${order.customer.id}`} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 hover:underline mt-0.5 block">
                  {order.customer.name}
                </Link>
              ) : (
                <p className="text-sm font-bold text-white mt-0.5">{order.customer?.name || 'N/A'}</p>
              )}
              <p className="text-xs text-slate-400">{order.customer?.phone || 'Không có SĐT'}</p>
              {order.customer?.facebook && (
                <p className="text-xs text-blue-400 underline mt-0.5">
                  <a href={order.customer.facebook} target="_blank" rel="noreferrer">Facebook Profile</a>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Dịch vụ</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-base">{order.service?.logo || '🔑'}</span>
                  <span className="text-xs font-bold text-slate-200 truncate">{order.service?.name}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Gói & Hạn</p>
                <p className="text-xs text-slate-300 mt-0.5">{order.packageName}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <p className="text-[10px] text-slate-500 font-bold uppercase">Thông tin tài khoản đăng nhập</p>
              <div className="mt-1 space-y-1 bg-[#131722]/50 p-2.5 rounded-xl border border-white/5 font-mono text-[11px] text-slate-300">
                <p>
                  <span className="text-slate-500">Email:</span>{' '}
                  {order.accountEmail ? (
                    <button
                      onClick={(e) => handleEmailClick(e, order.accountEmail, order.accountPassword || undefined)}
                      className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer focus:outline-none font-mono text-left"
                      title="Click 1 lần để copy Email, double click để copy Email + Password"
                    >
                      {order.accountEmail}
                    </button>
                  ) : (
                    'N/A'
                  )}
                </p>
                <p><span className="text-slate-500">Pass:</span> {order.accountPassword || 'N/A'}</p>
                {order.recoveryCode && <p className="truncate"><span className="text-slate-500">Backup:</span> {order.recoveryCode}</p>}
                {order.loginLink && (
                  <p className="truncate">
                    <span className="text-slate-500">Link:</span>{' '}
                    <a href={order.loginLink} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                      {order.loginLink}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Dates & Usage Status */}
        <div className="p-5 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Thời gian sử dụng
            </h3>
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold">
              Gói {durationDays} ngày
            </span>
          </div>

          <div className="space-y-4">
            {/* Display usage metrics clearly */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#131722]/40 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Đã dùng</p>
                <p className="text-lg font-black text-amber-400 mt-1">
                  {daysUsed} <span className="text-xs font-normal text-slate-400">/ {durationDays} ngày</span>
                </p>
              </div>

              <div className="bg-[#131722]/40 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Còn lại</p>
                <p className="text-lg font-black text-emerald-400 mt-1">
                  {daysRemaining} <span className="text-xs font-normal text-slate-400">ngày</span>
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày mua:</span>
                <span className="text-slate-300 font-medium">{formatDateShort(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày kích hoạt:</span>
                <span className="text-slate-300 font-medium">{formatDateShort(order.startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ngày hết hạn:</span>
                <span className="text-slate-300 font-medium">{formatDateShort(order.endDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Đơn giá ngày:</span>
                <span className="text-slate-300 font-medium font-mono">{formatCurrency(costPerDay)} / ngày</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Giá trị đã sử dụng:</span>
                <span className="text-amber-500/80 font-medium font-mono">{formatCurrency(Math.round(daysUsed * costPerDay))}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/5 items-center">
                <span className="text-slate-400 font-bold">Giá trị còn lại:</span>
                <span className="text-emerald-400 font-black text-sm font-mono">{formatCurrency(expectedClientRefund)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Financial Calculations & Real Profit */}
        <div className="p-5 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> Thống kê tài chính
            </h3>
            <div className="relative group cursor-pointer">
              <Info className="w-4 h-4 text-slate-400 hover:text-white" />
              <div className="absolute right-0 top-6 hidden group-hover:block w-72 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-[10px] leading-relaxed text-slate-300 space-y-1">
                <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1">Cách tính lợi nhuận bảo hành:</p>
                <p><strong>Lợi nhuận thực</strong> = Bán - Vốn - Hoàn khách + Nguồn hoàn</p>
                <p><strong>Hoàn khách tự tính</strong> = Giá bán / Tổng số ngày * Số ngày còn lại</p>
                <p><strong>Nguồn hoàn tự tính</strong> = Giá vốn / Tổng số ngày * Số ngày còn lại</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-slate-500 font-sans font-semibold">Giá bán</span>
              <span className="font-bold text-white">{formatCurrency(order.salePrice)}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-slate-500 font-sans font-semibold">Giá vốn</span>
              <span className="font-bold text-slate-300">{formatCurrency(order.costPrice)}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-slate-500 font-sans font-semibold">Hoàn khách dự kiến</span>
              <span className="font-bold text-rose-400/80">{formatCurrency(expectedClientRefund)}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-rose-400 font-sans font-bold">Hoàn khách thực tế</span>
              <span className="font-extrabold text-rose-400 text-sm">{formatCurrency(clientRefundVal)}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-slate-500 font-sans font-semibold">Nguồn hoàn dự kiến</span>
              <span className="font-bold text-emerald-400/80">{formatCurrency(expectedSourceRefund)}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="text-emerald-400 font-sans font-bold">Nguồn hoàn thực tế</span>
              <span className="font-extrabold text-emerald-400 text-sm">+{formatCurrency(sourceRefundVal)}</span>
            </div>
          </div>

          {/* Real Profit Block */}
          <div className={`p-3 rounded-xl border mt-2 ${realProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-rose-500/5 border-rose-500/10'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Lợi nhuận cuối cùng</span>
              {realProfit < 0 && (
                <span className="text-[8px] font-black text-rose-400 bg-rose-500/15 px-1 py-0.2 rounded border border-rose-500/20">BỊ LỖ</span>
              )}
            </div>
            <p className={`text-xl font-black mt-1 ${realProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatCurrency(realProfit)}
            </p>
            <p className="text-[9px] text-slate-500 mt-1 font-mono">
              Bán ({order.salePrice}) - Vốn ({order.costPrice}) - Hoàn ({clientRefundVal}) + Nguồn ({sourceRefundVal})
            </p>
          </div>
        </div>

      </div>

      {/* Body: Action Forms & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Logs & Note Histories */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Order system note */}
          {order.note && (
            <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">📝 Nhật ký ghi chú nội bộ</h3>
              <pre className="text-xs text-slate-300 font-mono bg-[#131722]/50 p-4 rounded-xl border border-white/5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {order.note}
              </pre>
            </div>
          )}

          {/* Activity logs / History */}
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" /> Nhật ký hoạt động (Timeline)
            </h3>
            <div className="space-y-3 pl-2 border-l border-white/5">
              {activityLogs.map((log: any) => (
                <div key={log.id} className="relative pl-6 pb-2 border-b border-white/3 last:border-b-0 last:pb-0">
                  <span className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-[#131722] border-2 border-indigo-500/50 flex items-center justify-center text-[7px]">🔹</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200">{log.action}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{log.details}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Người thực hiện: {log.user?.name || 'Hệ thống'}</p>
                </div>
              ))}
              {activityLogs.length === 0 && (
                <p className="text-xs text-slate-500 italic">Chưa có nhật ký hoạt động nào</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Warranty Actions & Overrides */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/60 border border-white/10 space-y-5 sticky top-6">
            
            <div>
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4" /> Thao tác nghiệp vụ
              </h3>
              <p className="text-[11px] text-slate-400">Điều chỉnh số tiền hoàn và chuyển trạng thái đơn lỗi</p>
            </div>

            {/* FINANCIAL OVERRIDES INPUTS */}
            <div className="space-y-3 p-3.5 rounded-xl bg-[#131722]/60 border border-white/5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider mb-2">✏️ CHỈNH SỬA TÀI CHÍNH</span>
              
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Tiền thực tế hoàn khách (đ)</label>
                <input
                  type="number"
                  value={actualClientRefund}
                  onChange={e => setActualClientRefund(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#1a1f2e] border border-white/10 text-rose-400 focus:border-rose-500 focus:outline-none font-mono font-bold"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Tiền thực tế nguồn hoàn (đ)</label>
                <input
                  type="number"
                  value={actualSourceRefund}
                  onChange={e => setActualSourceRefund(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#1a1f2e] border border-white/10 text-emerald-400 focus:border-emerald-500 focus:outline-none font-mono font-bold"
                  placeholder="0"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Nguồn dự kiến hoàn: <span className="font-bold">{formatCurrency(expectedSourceRefund)}</span>
                </p>
                {sourceRefundVal !== expectedSourceRefund && (
                  <p className={`text-[10px] font-bold mt-0.5 ${sourceRefundVal > expectedSourceRefund ? 'text-emerald-400' : 'text-rose-400'}`}>
                    Chênh lệch: {sourceRefundVal > expectedSourceRefund ? '+' : ''}{formatCurrency(sourceRefundVal - expectedSourceRefund)}
                  </p>
                )}
              </div>

              <button
                onClick={handleSaveFinancials}
                disabled={loading}
                className="w-full py-2 text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all mt-1"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                💾 Lưu số tiền chỉnh sửa
              </button>

              <button
                onClick={handleCopyCardImage}
                disabled={copying}
                className="w-full py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 border border-indigo-500/20 text-white rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all mt-1.5"
              >
                {copying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    Đang tạo ảnh...
                  </>
                ) : (
                  <>
                    📋 Copy ảnh đơn bảo hành
                  </>
                )}
              </button>
            </div>

            {/* NEXT STATUS TRANSITIONS */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">🔄 CHUYỂN TRẠNG THÁI TIẾP THEO</span>
              
              <textarea
                rows={2}
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                placeholder="Nhập ghi chú lý do / phản hồi bảo hành..."
              />

              {order.status === 'WARRANTY' && (
                <button
                  onClick={() => handleStatusChange('WARRANTY_PENDING_SOURCE')}
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-950/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  🟣 Chờ nguồn hoàn tiền
                </button>
              )}

              {order.status === 'WARRANTY_PENDING_SOURCE' && (
                <div className="space-y-2">
                  <button
                    onClick={() => handleStatusChange('WARRANTY_PENDING_REFUND')}
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/20"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    🟠 Nguồn đồng ý → Chờ hoàn khách
                  </button>
                  <button
                    onClick={() => handleStatusChange('WARRANTY_REJECTED')}
                    disabled={loading}
                    className="w-full py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    ⛔ Nguồn từ chối bảo hành
                  </button>
                </div>
              )}

              {order.status === 'WARRANTY_PENDING_REFUND' && (
                <button
                  onClick={() => handleStatusChange('WARRANTY_DONE')}
                  disabled={loading}
                  className="w-full py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  ✅ Đã hoàn tiền khách → Hoàn tất
                </button>
              )}

              {(order.status === 'WARRANTY_DONE' || order.status === 'WARRANTY_REJECTED') && (
                <div className="text-center text-xs text-slate-500 py-3 bg-white/3 border border-white/5 rounded-xl">
                  <p className="text-lg mb-1">{order.status === 'WARRANTY_DONE' ? '🏁' : '⛔'}</p>
                  <p className="font-bold">{order.status === 'WARRANTY_DONE' ? 'Đã hoàn tất bảo hành' : 'Bị từ chối bảo hành'}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Không cần thực hiện thêm thao tác nào</p>
                </div>
              )}
            </div>

            {/* Timeline audit block strictly for reference */}
            <div className="pt-4 border-t border-white/5 space-y-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">🏁 Lịch sử quy trình</span>
              <div className="space-y-1.5 text-xs text-slate-400 pl-1">
                {timelineSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={step.done ? 'opacity-100' : 'opacity-20'}>{step.icon}</span>
                    <span className={`text-[11px] ${step.done ? 'text-slate-300 font-bold' : 'text-slate-600'}`}>{step.label}</span>
                    {step.date && <span className="text-[9px] text-slate-600 ml-auto">{formatDateShort(step.date)}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Navigation links */}
            <div className="pt-3 border-t border-white/5 space-y-2">
              <Link href={`/admin/orders/${order.id}`}
                className="block w-full py-2 text-xs text-center text-slate-400 hover:text-white bg-white/5 hover:bg-[#1a1f2e] rounded-xl border border-white/5 transition-all">
                👁️ Xem chi tiết đơn gốc
              </Link>
              <Link href="/admin/warranty"
                className="block w-full py-2 text-xs text-center text-slate-400 hover:text-white bg-white/5 hover:bg-[#1a1f2e] rounded-xl border border-white/5 transition-all">
                ← Về danh sách bảo hành
              </Link>
            </div>

          </div>
        </div>

      </div>

      {/* Template Card Bảo hành ẩn dùng để render ảnh */}
      <div className="absolute" style={{ left: '-9999px', top: '0', pointerEvents: 'none' }}>
        <div
          ref={cardRef}
          className="w-[450px] p-6 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 flex flex-col gap-5 shadow-2xl font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <div>
                <h2 className="text-base font-extrabold text-white tracking-wide">BanHangMMO</h2>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Hệ thống dịch vụ số</p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wide">
                Phiếu Bảo Hành
              </span>
              <p className="text-[10px] text-slate-500 font-mono mt-1">ID: {order.id.slice(-6).toUpperCase()}</p>
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
              <span className="text-slate-400 font-medium">Mã đơn hàng</span>
              <span className="font-mono font-bold text-white text-sm">{order.orderCode}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
              <span className="text-slate-400 font-medium">Khách hàng</span>
              <span className="font-bold text-slate-200">{order.customer?.name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
              <span className="text-slate-400 font-medium">Dịch vụ</span>
              <span className="font-bold text-slate-200">{order.service?.logo || '🔑'} {order.service?.name}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
              <span className="text-slate-400 font-medium">Gói dịch vụ</span>
              <span className="font-semibold text-slate-300">{order.packageName}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-800/40">
              <span className="text-slate-400 font-medium">Người tạo đơn</span>
              <span className="font-semibold text-slate-300">{creatorName}</span>
            </div>
          </div>

          {/* Timeline Section */}
          <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Ngày giao (kích hoạt):</span>
              <span className="text-slate-300 font-medium">{formatDateShort(order.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ngày hết hạn:</span>
              <span className="text-slate-300 font-medium">{formatDateShort(order.endDate)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800/40 mt-1">
              <span className="text-slate-400 font-semibold">Thời hạn / Còn lại:</span>
              <span className="font-bold text-emerald-400">
                {durationDays} ngày (Còn {daysRemaining} ngày)
              </span>
            </div>
          </div>

          {/* Pricing Details */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400">Giá dịch vụ</span>
              <span className="font-mono font-bold text-white">{formatCurrency(order.salePrice)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400">Đã thanh toán</span>
              <span className="font-mono font-semibold text-slate-300">{formatCurrency(order.paidAmount)}</span>
            </div>

            {hasDebt && (
              <div className="flex justify-between items-center py-0.5 text-rose-400">
                <span className="font-semibold">Công nợ</span>
                <span className="font-mono font-bold">{formatCurrency(debtAmount)}</span>
              </div>
            )}

            <div className="flex justify-between items-center py-0.5 border-t border-slate-800/40 pt-2">
              <span className="text-slate-400">Giá sử dụng mỗi ngày</span>
              <span className="font-mono text-slate-300">{formatCurrency(costPerDay)}</span>
            </div>

            <div className="flex justify-between items-center bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mt-2">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Số tiền bảo hành/hoàn lại</span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">({daysRemaining} ngày còn lại)</span>
              </div>
              <span className="font-mono font-extrabold text-rose-400 text-lg">
                {formatCurrency(clientRefundVal)}
              </span>
            </div>
          </div>

          {/* Decorative Barcode */}
          <div className="flex flex-col items-center gap-1.5 border-t border-slate-800/60 pt-4 mt-1">
            <div className="flex gap-[2px] h-6 items-center opacity-60">
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[2px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[3px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[2px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[4px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[2px] h-full bg-slate-400"></div>
              <div className="w-[3px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[2px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
              <div className="w-[4px] h-full bg-slate-400"></div>
              <div className="w-[1px] h-full bg-slate-400"></div>
            </div>
            <p className="text-[9px] text-slate-500 text-center font-medium">
              Cảm ơn quý khách đã tin dùng dịch vụ của BanHangMMO!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
