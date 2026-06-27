import prisma from '@/lib/prisma';
import { formatCurrency, formatDate, formatDateShort, getStatusLabel, getStatusColor, getPaymentStatusLabel, getPaymentStatusColor } from '@/lib/utils';
import { Package, ArrowLeft, TrendingUp, AlertTriangle, ShoppingCart, DollarSign, Key, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ServiceAccountCell from './ServiceAccountCell';

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
        <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3.5 w-12 text-center">STT</th>
                <th className="px-5 py-3.5">Mã đơn</th>
                <th className="px-5 py-3.5">Khách hàng</th>
                <th className="px-5 py-3.5">Gói dịch vụ</th>
                <th className="px-5 py-3.5">Tài khoản</th>
                <th className="px-5 py-3.5">Tài chính</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-center">Thanh toán</th>
                <th className="px-5 py-3.5">Ngày mua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs text-slate-300">
              {service.orders.map((o: any, idx: number) => {
                return (
                  <tr key={o.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-5 py-4 font-bold font-mono text-indigo-400">
                      <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                        {o.orderCode}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-semibold text-white">
                      {o.customer ? (
                        <Link href={`/admin/customers/${o.customerId}`} className="hover:underline">
                          {o.customer.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">{o.packageName} ({o.durationDays} ngày)</td>
                    <td className="px-5 py-4">
                      <ServiceAccountCell email={o.accountEmail} password={o.accountPassword} />
                    </td>
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
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(o.status)}`}>
                        {getStatusLabel(o.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${getPaymentStatusColor(o.paymentStatus)}`}>
                        {getPaymentStatusLabel(o.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400 font-mono text-[11px]">{formatDate(o.createdAt)}</td>
                  </tr>
                );
              })}
              {service.orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500">Dịch vụ này chưa phát sinh đơn hàng nào</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
