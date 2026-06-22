import prisma from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Package, ArrowLeft, TrendingUp, AlertTriangle, ShoppingCart, DollarSign, Key, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const revalidate = 0; // Fresh details every load

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminServiceDetailPage({ params }: PageProps) {
  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          customer: true,
          refundHistories: true,
        }
      }
    }
  });

  if (!service || service.isDeleted) {
    notFound();
  }

  // Calculate metrics
  let totalOrders = service.orders.length;
  let errorOrders = 0;
  let totalRevenue = 0;
  let totalCost = 0;
  let totalRefund = 0;
  let totalSourceRefund = 0;

  service.orders.forEach((o: any) => {
    totalRevenue += o.salePrice;
    totalCost += o.costPrice;

    const hasError = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(o.status) || o.refundHistories.length > 0;
    if (hasError) {
      errorOrders++;
    }

    if (o.refundHistories) {
      o.refundHistories.forEach((r: any) => {
        totalRefund += r.amount;
        totalSourceRefund += r.sourceRefundActual ?? r.sourceAmount ?? 0;
      });
    }
  });

  const errorRate = totalOrders > 0 ? Math.round((errorOrders / totalOrders) * 100) : 0;
  const netProfit = totalRevenue - totalCost - totalRefund + totalSourceRefund;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Breadcrumbs / Back button */}
      <div>
        <Link
          href="/admin/services"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay lại danh sách dịch vụ
        </Link>
      </div>

      {/* Service Header Info */}
      <div className="flex items-start gap-4 p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl flex-shrink-0">
          {service.logo || '🔑'}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{service.name}</h1>
            {service.serviceType && (
              <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold">
                {service.serviceType}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
              service.isActive
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {service.isActive ? 'Đang kinh doanh' : 'Tạm dừng bán'}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500">ID: {service.id} • Slug: {service.slug}</p>
          {service.description && (
            <p className="text-xs text-slate-400 italic max-w-2xl pt-1">{service.description}</p>
          )}
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Doanh số */}
        <div className="p-5 rounded-2xl bg-[#1e2330]/50 border border-white/5">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🛍️ Tổng đơn hàng</p>
            <ShoppingCart className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-xl font-extrabold text-white mt-3">{totalOrders} đơn</p>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2">
            <span>Doanh thu:</span>
            <strong className="text-slate-300 font-semibold">{formatCurrency(totalRevenue)}</strong>
          </div>
        </div>

        {/* Lợi nhuận ròng */}
        <div className="p-5 rounded-2xl bg-[#1e2330]/50 border border-white/5">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">📈 Lợi nhuận thực</p>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-xl font-extrabold text-cyan-400 mt-3">{formatCurrency(netProfit)}</p>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2">
            <span>Chi phí vốn gốc:</span>
            <strong className="text-slate-300 font-semibold">{formatCurrency(totalCost)}</strong>
          </div>
        </div>

        {/* Đơn hàng báo lỗi */}
        <div className="p-5 rounded-2xl bg-[#1e2330]/50 border border-white/5">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">🚨 Số đơn lỗi</p>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-extrabold text-rose-400 mt-3">{errorOrders} đơn</p>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2">
            <span>Tỷ lệ lỗi dịch vụ:</span>
            <strong className="text-rose-400 font-bold">{errorRate}%</strong>
          </div>
        </div>

        {/* Hoàn tiền khách hàng */}
        <div className="p-5 rounded-2xl bg-[#1e2330]/50 border border-white/5">
          <div className="flex justify-between items-start">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">💸 Hoàn tiền khách</p>
            <DollarSign className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-xl font-extrabold text-orange-400 mt-3">{formatCurrency(totalRefund)}</p>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2">
            <span>Nguồn hoàn:</span>
            <strong className="text-teal-400 font-bold">+{formatCurrency(totalSourceRefund)}</strong>
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">📋 Danh sách đơn hàng bán ra</h2>
          <p className="text-xs text-slate-400 mt-0.5">Hiển thị toàn bộ các đơn hàng đã tạo của dịch vụ này.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-slate-400 pb-2.5 font-bold uppercase tracking-wider">
                <th className="py-2.5 w-12 text-center">STT</th>
                <th className="py-2.5">Mã đơn</th>
                <th className="py-2.5">Khách hàng</th>
                <th className="py-2.5">Gói dịch vụ</th>
                <th className="py-2.5">Tài khoản</th>
                <th className="py-2.5 text-right">Giá bán</th>
                <th className="py-2.5 text-right">Giá vốn</th>
                <th className="py-2.5 text-center">Trạng thái</th>
                <th className="py-2.5 text-center">Thanh toán</th>
                <th className="py-2.5">Ngày mua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {service.orders.map((o: any, idx: number) => {
                let statusBadge = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                if (o.status === 'ACTIVE') statusBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                if (o.status === 'EXPIRING_SOON') statusBadge = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                if (o.status === 'EXPIRED') statusBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                if (o.status.startsWith('WARRANTY')) statusBadge = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

                let paymentBadge = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                if (o.paymentStatus === 'PAID') paymentBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                if (o.paymentStatus === 'UNPAID') paymentBadge = 'bg-red-500/10 text-red-400 border border-red-500/20';
                if (o.paymentStatus === 'OVERDUE') paymentBadge = 'bg-rose-500/10 text-rose-500 border border-rose-500/20';

                return (
                  <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3.5 font-bold font-mono text-indigo-400">
                      <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                        {o.orderCode}
                      </Link>
                    </td>
                    <td className="py-3.5 font-semibold text-white">
                      {o.customer ? (
                        <Link href={`/admin/debts/${o.customerId}`} className="hover:underline">
                          {o.customer.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5">{o.packageName} ({o.durationDays} ngày)</td>
                    <td className="py-3.5 max-w-[150px] truncate" title={o.accountEmail || ''}>
                      {o.accountEmail || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 text-right font-bold text-white font-mono">{formatCurrency(o.salePrice)}</td>
                    <td className="py-3.5 text-right text-slate-400 font-mono">{formatCurrency(o.costPrice)}</td>
                    <td className="py-3.5 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${statusBadge}`}>
                        {o.status === 'ACTIVE' ? 'Đang dùng' :
                         o.status === 'EXPIRING_SOON' ? 'Sắp hết hạn' :
                         o.status === 'EXPIRED' ? 'Hết hạn' : o.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold ${paymentBadge}`}>
                        {o.paymentStatus === 'PAID' ? 'Đã TT' :
                         o.paymentStatus === 'UNPAID' ? 'Chưa TT' : 'Quá hạn'}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-400 font-mono text-[11px]">{formatDate(o.createdAt)}</td>
                  </tr>
                );
              })}
              {service.orders.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-500">Dịch vụ này chưa phát sinh đơn hàng nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
