'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle2, DollarSign, AlertTriangle, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateShort, calculateCreditRating } from '@/lib/utils';
import { CREDIT_RATING_CONFIG } from '@/lib/constants';

export default function CustomerDebtDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.customerId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [partialAmount, setPartialAmount] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/debts/${customerId}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('Không tải được dữ liệu');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // #73 - Payment actions
  const handlePayAll = async () => {
    if (!confirm('Xác nhận đã thanh toán toàn bộ đơn chưa thanh toán?')) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/admin/debts/${customerId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all', method: paymentMethod, note: paymentNote }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Đã xác nhận thanh toán ${result.orderCount} đơn · ${formatCurrency(result.totalPaid)}`);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setPaying(false); }
  };

  const handlePaySelected = async () => {
    if (selectedOrderIds.size === 0) { toast.error('Chọn ít nhất 1 đơn'); return; }
    setPaying(true);
    try {
      const res = await fetch(`/api/admin/debts/${customerId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'partial_orders', orderIds: Array.from(selectedOrderIds), method: paymentMethod, note: paymentNote }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Đã xác nhận thanh toán ${result.orderCount} đơn · ${formatCurrency(result.totalPaid)}`);
        setSelectedOrderIds(new Set());
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setPaying(false); }
  };

  const handlePayAmount = async () => {
    if (!partialAmount || parseFloat(partialAmount) <= 0) { toast.error('Nhập số tiền hợp lệ'); return; }
    setPaying(true);
    try {
      const res = await fetch(`/api/admin/debts/${customerId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'partial_amount', amount: partialAmount, method: paymentMethod, note: paymentNote }),
      });
      if (res.ok) {
        const result = await res.json();
        toast.success(`Đã xác nhận thanh toán ${formatCurrency(result.totalPaid)} cho ${result.orderCount} đơn`);
        setPartialAmount('');
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thất bại');
      }
    } catch { toast.error('Lỗi kết nối'); }
    finally { setPaying(false); }
  };

  const handleQuickPay = async (orderId: string, orderCode: string, amount: number) => {
    const confirmMethod = prompt(`Xác nhận thanh toán ${formatCurrency(amount)} cho đơn ${orderCode}?\nNhập phương thức (bank, cash, momo, zalopay) hoặc bỏ trống để mặc định là 'bank':`, 'bank');
    if (confirmMethod === null) return; // Cancelled
    
    setPaying(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          paymentMethod: confirmMethod || 'bank',
          paymentNote: 'Thanh toán nhanh từ màn hình công nợ',
        }),
      });
      if (res.ok) {
        toast.success(`Đã xác nhận thanh toán đơn ${orderCode}!`);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setPaying(false);
    }
  };

  const toggleOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mr-2" /> Đang tải...
      </div>
    );
  }

  if (!data) return null;

  const { customer, unpaidOrders, paymentRecords, stats } = data;
  const creditRating = calculateCreditRating(stats);
  const ratingConfig = CREDIT_RATING_CONFIG[creditRating] || CREDIT_RATING_CONFIG['B'];

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/debts" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            Công nợ ·{' '}
            <Link href={`/admin/customers/${customer.id}`} className="text-indigo-400 hover:text-indigo-300 hover:underline">
              {customer.name}
            </Link>
          </h1>
          <p className="text-sm text-slate-400 mt-1">{customer.phone || 'Không có SĐT'}</p>
        </div>
      </div>

      {/* Stats + Credit Rating (#66, #67) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p className="text-[10px] font-bold text-rose-400 uppercase">Đang nợ</p>
          <p className="text-xl font-bold text-rose-400 mt-1">{formatCurrency(stats.totalDebt)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] font-bold text-amber-400 uppercase">Đơn chưa TT</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{stats.currentDebtCount} đơn</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-[10px] font-bold text-emerald-400 uppercase">TT đúng hạn</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{stats.paidOnTimeCount} lần</p>
        </div>
        <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
          <p className="text-[10px] font-bold text-orange-400 uppercase">TT trễ hạn</p>
          <p className="text-xl font-bold text-orange-400 mt-1">{stats.latePaymentCount} lần</p>
        </div>
        <div className={`p-4 rounded-2xl border relative group cursor-help ${ratingConfig.color}`}>
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase">Uy tín</p>
            <span className="text-[10px] text-slate-400">❓</span>
          </div>
          <p className="text-2xl font-black mt-1">{ratingConfig.label}</p>
          <div className="absolute right-0 top-16 hidden group-hover:block w-72 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-[11px] leading-relaxed text-slate-300 space-y-2 font-normal text-left">
            <p className="font-bold text-white border-b border-slate-700 pb-1">Giải nghĩa xếp hạng uy tín:</p>
            <p><span className="font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">A+</span> Thanh toán luôn đúng hạn. Không nợ. Khách VIP.</p>
            <p><span className="font-bold text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded">A</span> Rất uy tín. Hiếm khi thanh toán trễ.</p>
            <p><span className="font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">B</span> Thỉnh thoảng thanh toán trễ. Có thể bán tiếp.</p>
            <p><span className="font-bold text-orange-400 bg-orange-500/10 px-1 py-0.2 rounded">C</span> Thường xuyên thanh toán trễ. Cần theo dõi.</p>
            <p><span className="font-bold text-red-400 bg-red-500/10 px-1 py-0.2 rounded">D</span> Nợ nhiều. Thanh toán rất chậm. Hạn chế giao trước.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Unpaid orders */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white">📋 Đơn chưa thanh toán</h2>

          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox"
                      checked={selectedOrderIds.size === unpaidOrders.length && unpaidOrders.length > 0}
                      onChange={() => {
                        if (selectedOrderIds.size === unpaidOrders.length) setSelectedOrderIds(new Set());
                        else setSelectedOrderIds(new Set(unpaidOrders.map((o: any) => o.id)));
                      }}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer" />
                  </th>
                  <th className="px-4 py-3">Mã đơn / Dịch vụ</th>
                  <th className="px-4 py-3">Ngày giao tài khoản</th>
                  <th className="px-4 py-3">Ngày bắt đầu nợ</th>
                  <th className="px-4 py-3 text-center">Số ngày đã nợ</th>
                  <th className="px-4 py-3 text-right">Giá bán</th>
                  <th className="px-4 py-3 text-right">Giá vốn</th>
                  <th className="px-4 py-3 text-right">Lợi nhuận dự kiến</th>
                  <th className="px-4 py-3 text-right">Còn nợ</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {unpaidOrders.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">🎉 Không còn nợ!</td></tr>
                ) : unpaidOrders.map((order: any) => {
                  const now = new Date();
                  const startDateObj = new Date(order.startDate);
                  const daysInDebt = order.daysInDebt !== undefined ? order.daysInDebt : Math.max(0, Math.floor((now.getTime() - startDateObj.getTime()) / (24 * 60 * 60 * 1000)));
                  
                  let statusText = '';
                  let statusClass = '';
                  if (daysInDebt === 0) {
                    statusText = 'Hôm nay';
                    statusClass = 'text-slate-400 font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10';
                  } else {
                    statusText = `Đã nợ ${daysInDebt} ngày`;
                    if (daysInDebt <= 3) {
                      statusClass = 'text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20';
                    } else if (daysInDebt <= 7) {
                      statusClass = 'text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20';
                    } else {
                      statusClass = 'text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20';
                    }
                  }

                  return (
                    <tr key={order.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedOrderIds.has(order.id)} onChange={() => toggleOrder(order.id)}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-indigo-400 block">{order.orderCode}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span>{order.service?.logo || '🔑'}</span>
                          <span className="text-slate-300 font-medium">{order.service?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {formatDateShort(order.startDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {formatDateShort(order.startDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block text-[10px] ${statusClass}`}>
                          {statusText}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 font-mono">{formatCurrency(order.salePrice)}</td>
                      <td className="px-4 py-3 text-right text-slate-400 font-mono">{formatCurrency(order.costPrice)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">{formatCurrency(order.profit)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400 font-mono">{formatCurrency(order.remainingAmount)}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleQuickPay(order.id, order.orderCode, order.remainingAmount)}
                          disabled={paying}
                          className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 rounded border border-emerald-500/20 transition-all cursor-pointer"
                        >
                          🟢 Nhận thanh toán
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* #66 - Payment history */}
          {paymentRecords && paymentRecords.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" /> Lịch sử thanh toán
              </h2>
              <div className="space-y-2">
                {paymentRecords.map((pr: any) => (
                  <div key={pr.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                    <div>
                      <p className="text-slate-300">{pr.order?.orderCode || 'Nhiều đơn'} · {pr.method || 'N/A'}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{pr.note}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold font-mono">+{formatCurrency(pr.amount)}</p>
                      <p className="text-[10px] text-slate-500">{formatDateShort(pr.paidAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Payment actions (#73) */}
        <div className="space-y-4 sticky top-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Xác nhận thanh toán
            </h3>

            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none">
              <option value="">Phương thức TT</option>
              <option value="bank">🏦 Chuyển khoản</option>
              <option value="cash">💵 Tiền mặt</option>
              <option value="momo">📱 Momo</option>
              <option value="zalopay">💳 ZaloPay</option>
            </select>

            <input type="text" placeholder="Ghi chú..." value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />

            {/* Pay all */}
            <button onClick={handlePayAll} disabled={paying || unpaidOrders.length === 0}
              className="w-full py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all">
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              ✅ Thanh toán toàn bộ ({formatCurrency(stats.totalDebt)})
            </button>

            {/* Pay selected */}
            {selectedOrderIds.size > 0 && (
              <button onClick={handlePaySelected} disabled={paying}
                className="w-full py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all">
                {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Thanh toán {selectedOrderIds.size} đơn đã chọn
              </button>
            )}

            {/* Pay partial amount */}
            <div className="border-t border-white/5 pt-4 space-y-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Thanh toán một phần</p>
              <input type="number" placeholder="Nhập số tiền..." value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white font-mono focus:border-indigo-500 focus:outline-none" />
              <button onClick={handlePayAmount} disabled={paying || !partialAmount}
                className="w-full py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl cursor-pointer transition-all">
                Xác nhận thanh toán số tiền
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
