'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Loader2,
  Building,
  AlertCircle
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import toast from 'react-hot-toast';

interface NotificationsViewProps {
  services: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  warrantyOrders: any[];
  pendingRefundOrders: any[];
}

export default function NotificationsView({
  warrantyOrders,
  pendingRefundOrders,
}: NotificationsViewProps) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [localPendingRefundOrders, setLocalPendingRefundOrders] = useState(pendingRefundOrders);

  useEffect(() => {
    setLocalPendingRefundOrders(pendingRefundOrders);
  }, [pendingRefundOrders]);

  const handleConfirmRefund = async (orderId: string) => {
    if (confirmingId) return;
    setConfirmingId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetStatus: 'REFUNDED',
          reason: 'Xác nhận chuyển khoản qua trang Cảnh báo vận hành',
        }),
      });

      if (res.ok) {
        toast.success('Xác nhận chuyển tiền thành công!');
        setLocalPendingRefundOrders(prev => prev.filter(o => o.id !== orderId));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Lỗi khi xác nhận hoàn tiền');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setConfirmingId(null);
    }
  };

  // Group pending refunds:
  // "Chờ nguồn xử lý": sourceStatus !== 'REFUNDED' && sourceStatus !== 'REJECTED' (still waiting for source refund sync)
  // "Chờ hoàn tiền khách": ready to refund to customer
  const waitingSourceOrders = localPendingRefundOrders.filter(
    o => o.refundHistories?.[0]?.sourceStatus === 'REQUESTED' || o.refundHistories?.[0]?.sourceStatus === 'NOT_REQUESTED'
  );

  const waitingClientRefundOrders = localPendingRefundOrders.filter(
    o => o.refundHistories?.[0]?.sourceStatus === 'APPROVED' || o.refundHistories?.[0]?.sourceStatus === 'REFUNDED'
  );

  return (
    <div className="space-y-6 text-white animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Bell className="w-7 h-7 text-indigo-400" />
          🛡️ Bảo hành & Thông báo
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-medium">
          Giám sát bảo hành lỗi khách báo, đối soát công nợ nguồn hàng và quản lý hoàn tiền.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Warranty */}
        <div className="space-y-6">
          
          {/* Section 1: Đơn lỗi bảo hành */}
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wider border-b border-white/5 pb-2.5">
              <ShieldAlert className="w-4.5 h-4.5 text-blue-400" />
              1. Đơn lỗi đang bảo hành ({warrantyOrders.length})
            </h3>
            
            <div className="space-y-3">
              {warrantyOrders.map((o: any) => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:border-blue-500/20 transition-all font-mono">
                  <div className="flex items-start gap-3">
                    <span className="text-lg p-1.5 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">🛠️</span>
                    <div className="font-sans">
                      <h4 className="text-sm font-bold text-white">
                        {o.service.name} - {o.packageName} ({o.orderCode})
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Khách hàng: <strong className="text-slate-300">{o.customer.name}</strong> · Tài khoản: <span className="font-mono text-slate-300">{o.accountEmail || '—'}</span>
                      </p>
                    </div>
                  </div>
                  <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold self-start sm:self-auto font-sans">
                    Chi tiết sự cố <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}

              {warrantyOrders.length === 0 && (
                <p className="text-slate-500 italic text-xs text-center py-4 font-sans">Không có sự cố bảo hành tồn đọng.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Refunds & Supplier Reconciliation */}
        <div className="space-y-6">

          {/* Section 2: Đơn chờ nguồn đối soát */}
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-purple-400 flex items-center gap-2 uppercase tracking-wider border-b border-white/5 pb-2.5">
              <Building className="w-4.5 h-4.5 text-purple-400" />
              2. Đơn chờ nguồn xử lý đối soát ({waitingSourceOrders.length})
            </h3>
            
            <div className="space-y-4">
              {waitingSourceOrders.map((o: any) => {
                const refundHist = o.refundHistories?.[0];
                const refundAmount = refundHist?.amount || 0;
                const daysUsed = refundHist?.daysUsed ?? 0;
                const daysRemaining = refundHist?.daysRemaining ?? 0;
                const costPerDay = refundHist?.costPerDay ?? 0;
                const errorDate = refundHist?.errorDate;
                const sourceRefundExpected = refundHist?.sourceRefundExpected || 0;
                const sourceRefundActual = refundHist?.sourceRefundActual || 0;

                return (
                  <div key={o.id} className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-3 font-mono">
                    <div className="flex justify-between items-start">
                      <div className="font-sans">
                        <h4 className="text-sm font-bold text-white">
                          {o.service.name} - {o.packageName} ({o.orderCode})
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Nguồn nhập: <strong className="text-purple-300">{o.supplierSourceName || 'Nhập thủ công'}</strong> · Khách: <strong className="text-slate-300">{o.customer.name}</strong>
                        </p>
                      </div>
                      <Link href={`/admin/orders/${o.id}`} className="text-xs text-purple-400 hover:underline font-semibold font-sans">
                        Chi tiết đơn
                      </Link>
                    </div>

                    {/* Pro-rata details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-white/2 p-3 rounded-lg border border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase font-bold font-sans block">Ngày lỗi</span>
                        <span className="text-slate-300">{errorDate ? formatDate(errorDate) : '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase font-bold font-sans block">Đã dùng / Còn lại</span>
                        <span className="text-slate-300">{daysUsed}d / {daysRemaining}d</span>
                      </div>
                      <div>
                        <span className="text-orange-400 text-[9px] uppercase font-bold font-sans block">Hoàn khách dự kiến</span>
                        <span className="text-orange-400 font-semibold">{formatCurrency(refundAmount)}</span>
                      </div>
                      <div>
                        <span className="text-purple-400 text-[9px] uppercase font-bold font-sans block">Nguồn phải hoàn</span>
                        <span className="text-purple-400 font-bold">{formatCurrency(sourceRefundExpected)}</span>
                      </div>
                      <div>
                        <span className="text-indigo-400 text-[9px] uppercase font-bold font-sans block">Nguồn hoàn thực tế</span>
                        <span className="text-indigo-400">{formatCurrency(sourceRefundActual)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {waitingSourceOrders.length === 0 && (
                <p className="text-slate-500 italic text-xs text-center py-4 font-sans">Không có đơn hàng nào chờ nguồn xử lý.</p>
              )}
            </div>
          </div>

          {/* Section 3: Đơn chờ hoàn tiền khách */}
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-xs font-bold text-orange-400 flex items-center gap-2 uppercase tracking-wider border-b border-white/5 pb-2.5">
              <DollarSign className="w-4.5 h-4.5 text-orange-400" />
              3. Đơn chờ hoàn tiền cho khách ({waitingClientRefundOrders.length})
            </h3>
            
            <div className="space-y-4">
              {waitingClientRefundOrders.map((o: any) => {
                const refundHist = o.refundHistories?.[0];
                const refundAmount = refundHist?.amount || 0;
                const daysUsed = refundHist?.daysUsed ?? 0;
                const daysRemaining = refundHist?.daysRemaining ?? 0;
                const errorDate = refundHist?.errorDate;
                const sourceRefundActual = refundHist?.sourceRefundActual || 0;

                return (
                  <div key={o.id} className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 space-y-3 font-mono">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="font-sans">
                        <h4 className="text-sm font-bold text-white">
                          {o.service.name} - {o.packageName} ({o.orderCode})
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Khách hàng: <strong className="text-slate-300">{o.customer.name}</strong> · SĐT Zalo: <span className="text-slate-300">{o.customer.phone || '—'}</span>
                        </p>
                      </div>
                      
                      <button
                        onClick={() => handleConfirmRefund(o.id)}
                        disabled={confirmingId === o.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white cursor-pointer transition-all flex items-center gap-1 font-sans shadow-md shadow-orange-500/10"
                      >
                        {confirmingId === o.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Xác nhận đã chuyển tiền
                          </>
                        )}
                      </button>
                    </div>

                    {/* Pro-rata details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/2 p-3 rounded-lg border border-white/5 text-[11px]">
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase font-bold font-sans block">Ngày báo lỗi</span>
                        <span className="text-slate-300">{errorDate ? formatDate(errorDate) : '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] uppercase font-bold font-sans block">Đã dùng / Còn lại</span>
                        <span className="text-slate-300">{daysUsed}d / {daysRemaining}d</span>
                      </div>
                      <div>
                        <span className="text-emerald-400 text-[9px] uppercase font-bold font-sans block">Nguồn đã hoàn</span>
                        <span className="text-emerald-400 font-semibold">{formatCurrency(sourceRefundActual)}</span>
                      </div>
                      <div>
                        <span className="text-orange-400 text-[9px] uppercase font-bold font-sans block">Tiền hoàn khách</span>
                        <span className="text-orange-400 font-bold text-xs">{formatCurrency(refundAmount)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {waitingClientRefundOrders.length === 0 && (
                <p className="text-slate-500 italic text-xs text-center py-4 font-sans">Không có đơn hàng nào chờ hoàn tiền cho khách.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
