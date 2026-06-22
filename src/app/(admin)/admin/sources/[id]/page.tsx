import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, MessageCircle, Mail, AlertTriangle, ShieldCheck, Box, ShoppingCart, TrendingUp, HelpCircle } from 'lucide-react';
import { formatCurrency, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';

export const revalidate = 0; // Disable cache

async function getSourceData(id: string) {
  const source = await prisma.supplierSource.findUnique({
    where: { id },
    include: {
      orders: {
        include: {
          customer: true,
          service: true,
          refundHistories: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!source) return null;

  // Calculate stats
  const totalOrders = source.orders.length;
  let totalCost = 0;
  let totalRevenue = 0;
  let totalErrors = 0;
  let totalSourceRefundExpected = 0;
  let totalSourceRefundActual = 0;
  let totalSourceRefundRejected = 0;
  let totalRefund = 0; // client refund

  source.orders.forEach((o: any) => {
    totalCost += o.costPrice;
    totalRevenue += o.salePrice;

    const hasErrors = o.status === 'WARRANTY' || o.status === 'PENDING_REFUND' || o.status === 'REFUNDED' || o.status === 'WARRANTY_REJECTED' || (o.refundHistories && o.refundHistories.length > 0);
    if (hasErrors) {
      totalErrors++;
    }

    if (o.refundHistories) {
      o.refundHistories.forEach((r: any) => {
        totalRefund += r.amount;
        totalSourceRefundExpected += r.sourceRefundExpected || 0;
        totalSourceRefundActual += r.sourceRefundActual || 0;
        if (r.sourceStatus === 'REJECTED') {
          totalSourceRefundRejected += r.sourceRefundExpected || 0;
        }
      });
    }
  });

  const errorRate = totalOrders > 0 ? parseFloat(((totalErrors / totalOrders) * 100).toFixed(1)) : 0;
  const netDebt = totalSourceRefundExpected - totalSourceRefundActual;
  const totalProfit = totalRevenue - totalCost - totalRefund + totalSourceRefundActual;

  return {
    source,
    stats: {
      totalCost,
      totalOrders,
      totalRevenue,
      totalProfit,
      totalRefund,
      errorRate,
      totalErrors,
      totalSourceRefundExpected,
      totalSourceRefundActual,
      totalSourceRefundRejected,
      netDebt,
    },
  };
}

export default async function SupplierSourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getSourceData(id);

  if (!data) {
    notFound();
  }

  const { source, stats } = data;

  return (
    <div className="space-y-6 text-white animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/sources" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🔌 Hồ sơ nguồn: {source.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">Đánh giá hiệu suất nhập hàng, công nợ hoàn tiền và kiểm soát chất lượng lỗi.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tổng đơn liên kết</p>
          <p className="text-2xl font-bold text-white mt-1">{stats.totalOrders} đơn</p>
        </div>
        <div className={`p-4 rounded-2xl border ${stats.errorRate > 10 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
            Tỷ lệ lỗi
            {stats.errorRate > 10 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
          </p>
          <p className={`text-2xl font-black mt-1 ${stats.errorRate > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {stats.errorRate}%
          </p>
        </div>
        <div className={`p-4 rounded-2xl border ${stats.netDebt > 0 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-[#1a1f2e]/40 border-white/5'}`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn còn nợ</p>
          <p className={`text-2xl font-bold mt-1 ${stats.netDebt > 0 ? 'text-amber-400' : 'text-white'}`}>
            {formatCurrency(stats.netDebt)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Đã hoàn trả</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(stats.totalSourceRefundActual)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e] border border-white/5">
          <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Lợi nhuận ròng</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{formatCurrency(stats.totalProfit)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Orders list from this source */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-indigo-400" /> Danh sách đơn hàng ({source.orders.length})
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Dịch vụ & Gói</th>
                  <th className="px-4 py-3 text-right">Vốn</th>
                  <th className="px-4 py-3 text-right">Giá bán</th>
                  <th className="px-4 py-3">Ngày bắt đầu</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {source.orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                      Nguồn này chưa có đơn hàng liên kết nào
                    </td>
                  </tr>
                ) : (
                  source.orders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-bold text-indigo-400">
                        <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                          {o.orderCode}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-white">{o.customer?.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{o.customer?.phone || 'No Phone'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span>{o.service?.logo || '🔑'}</span>
                          <div>
                            <p className="font-semibold text-white">{o.service?.name}</p>
                            <p className="text-[10px] text-slate-500">{o.packageName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 font-mono">{formatCurrency(o.costPrice)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">{formatCurrency(o.salePrice)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatDate(o.startDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(o.status)}`}>
                          {getStatusLabel(o.status)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Contact & Notes */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">📞 Thông tin liên hệ</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-sky-400" /> Telegram:
                </span>
                <span className="text-white font-medium">
                  {source.telegram ? (
                    <a href={`https://t.me/${source.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                      {source.telegram}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-emerald-400" /> Zalo:
                </span>
                <span className="text-white font-medium">
                  {source.zalo ? (
                    <a href={`https://zalo.me/${source.zalo}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                      {source.zalo}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-purple-400" /> Email:
                </span>
                <span className="text-white font-medium truncate max-w-[150px]" title={source.email || ''}>
                  {source.email ? (
                    <a href={`mailto:${source.email}`} className="text-purple-400 hover:underline">
                      {source.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>

            {source.note && (
              <div className="pt-3 border-t border-white/5 space-y-2">
                <h4 className="text-[10px] text-slate-500 uppercase font-bold">Ghi chú vận hành</h4>
                <p className="text-xs text-slate-300 leading-relaxed italic whitespace-pre-line bg-white/2 p-3 rounded-lg border border-white/5">
                  {source.note}
                </p>
              </div>
            )}
          </div>

          {/* Source Refund Summary card */}
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-3.5 text-xs">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Báo cáo bảo hành nguồn
            </h3>
            <div className="space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Đơn hàng bị lỗi:</span>
                <span className="text-white font-bold">{stats.totalErrors} / {stats.totalOrders} đơn</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng tiền hoàn khách:</span>
                <span className="text-rose-400 font-bold">{formatCurrency(stats.totalRefund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nguồn dự kiến hoàn:</span>
                <span className="text-purple-300 font-bold">{formatCurrency(stats.totalSourceRefundExpected)}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-500">Nguồn đã hoàn trả:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(stats.totalSourceRefundActual)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nguồn đã từ chối:</span>
                <span className="text-rose-400 font-bold">{formatCurrency(stats.totalSourceRefundRejected)}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-500 font-bold">Nguồn đang còn nợ:</span>
                <span className={`font-extrabold ${stats.netDebt > 0 ? 'text-amber-400' : 'text-white'}`}>
                  {formatCurrency(stats.netDebt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
