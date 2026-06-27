'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send, MessageCircle, Mail, AlertTriangle, ShieldCheck, Box, ShoppingCart, TrendingUp, HelpCircle, Phone, Globe } from 'lucide-react';
import { formatCurrency, formatDate, formatDateShort, getStatusLabel, getStatusColor } from '@/lib/utils';

interface SourceDetailViewProps {
  source: any;
  stats: {
    totalCost: number;
    totalOrders: number;
    totalRevenue: number;
    totalProfit: number;
    totalRefund: number;
    errorRate: number;
    totalErrors: number;
    totalSourceRefundExpected: number;
    totalSourceRefundActual: number;
    totalSourceRefundRejected: number;
    netDebt: number;
  };
}

export default function SourceDetailView({ source, stats }: SourceDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'orders' | 'warranty'>('orders');

  return (
    <div className="space-y-6 text-white animate-fade-in pb-12">
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

      {/* Profile & Contact Grid (Top) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile / Notes */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xl border border-indigo-500/20 flex-shrink-0">
                {source.name.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-white">{source.name}</h2>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${stats.errorRate > 10 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                    Lỗi: {stats.errorRate}%
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Đã bán: {stats.totalOrders} đơn
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-1 pt-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Ghi chú vận hành</span>
              <p className="text-xs text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5 leading-relaxed min-h-[50px] whitespace-pre-line">
                {source.note || 'Không có ghi chú vận hành.'}
              </p>
            </div>
          </div>
        </div>

        {/* Contact details */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 flex flex-col justify-between space-y-4">
          <div className="space-y-3.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thông tin liên hệ</h3>
            
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-400" /> Telegram:
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
            
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-500 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" /> Zalo:
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
            
            <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-purple-400" /> Email:
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

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
            {source.telegram && (
              <a href={`https://t.me/${source.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-medium border border-sky-500/20 transition-all">
                Telegram
              </a>
            )}
            {source.zalo && (
              <a href={`https://zalo.me/${source.zalo}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 text-xs font-medium border border-teal-500/20 transition-all">
                Zalo
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row (Full Width) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tổng đơn liên kết</p>
          <p className="text-xl font-bold text-white mt-1">{stats.totalOrders} đơn</p>
        </div>
        <div className={`p-4 rounded-2xl border ${stats.errorRate > 10 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center gap-1">
            Tỷ lệ lỗi
            {stats.errorRate > 10 ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
          </p>
          <p className={`text-xl font-black mt-1 ${stats.errorRate > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {stats.errorRate}%
          </p>
        </div>
        <div className={`p-4 rounded-2xl border ${stats.netDebt > 0 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-[#1a1f2e]/40 border-white/5'}`}>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn còn nợ</p>
          <p className={`text-xl font-bold mt-1 ${stats.netDebt > 0 ? 'text-amber-400' : 'text-white'}`}>
            {formatCurrency(stats.netDebt)}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Đã hoàn trả</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(stats.totalSourceRefundActual)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-[#1a1f2e] border border-white/5">
          <p className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">Lợi nhuận ròng</p>
          <p className="text-xl font-bold text-cyan-400 mt-1">{formatCurrency(stats.totalProfit)}</p>
        </div>
      </div>

      {/* Tabs Menu (Full Width) */}
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
            📦 Đơn hàng liên kết ({source.orders.length})
          </button>
          <button
            onClick={() => setActiveTab('warranty')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'warranty'
                ? 'border-rose-500 text-rose-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            🛠 Báo cáo bảo hành nguồn
          </button>
        </div>

        {/* Tab Contents */}
        <div className="mt-4">
          {activeTab === 'orders' && (
            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-5 py-3.5 w-12 text-center">STT</th>
                    <th className="px-5 py-3.5">Mã đơn</th>
                    <th className="px-5 py-3.5">Khách hàng</th>
                    <th className="px-5 py-3.5">Dịch vụ & Gói</th>
                    <th className="px-5 py-3.5">Tài chính</th>
                    <th className="px-5 py-3.5 text-center">Ngày tạo</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                  {source.orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-500 italic">
                        Nguồn này chưa có đơn hàng liên kết nào
                      </td>
                    </tr>
                  ) : (
                    source.orders.map((o: any, idx: number) => (
                      <tr key={o.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-5 py-4 font-bold text-indigo-400">
                          <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                            {o.orderCode}
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-white">{o.customer?.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{o.customer?.phone || 'No Phone'}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span>{o.service?.logo || '🔑'}</span>
                            <div>
                              <p className="font-semibold text-white">{o.service?.name}</p>
                              <p className="text-[10px] text-slate-500">{o.packageName}</p>
                            </div>
                          </div>
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
                        <td className="px-5 py-4 text-slate-400 font-mono text-center">{o.createdAt ? formatDateShort(o.createdAt) : '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getStatusColor(o.status)}`}>
                            {getStatusLabel(o.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'warranty' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Warranty details table */}
              <div className="lg:col-span-2 overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3.5 w-12 text-center">STT</th>
                      <th className="px-5 py-3.5">Đơn hàng</th>
                      <th className="px-5 py-3.5 text-center">Ngày lỗi</th>
                      <th className="px-5 py-3.5">Khách hoàn</th>
                      <th className="px-5 py-3.5">Nguồn dự kiến</th>
                      <th className="px-5 py-3.5">Nguồn thực hoàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                    {source.orders.filter((o: any) => o.refundHistories && o.refundHistories.length > 0).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 italic">
                          Chưa có lịch sử bảo hành/hoàn trả nào từ nguồn này
                        </td>
                      </tr>
                    ) : (
                      source.orders
                        .filter((o: any) => o.refundHistories && o.refundHistories.length > 0)
                        .map((o: any, idx: number) => {
                          const latestRefund = o.refundHistories[0];
                          return (
                            <tr key={o.id} className="hover:bg-white/2 transition-colors">
                              <td className="px-5 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="px-5 py-4">
                                <Link href={`/admin/orders/${o.id}`} className="font-bold text-indigo-400 hover:underline block font-mono">
                                  {o.orderCode}
                                </Link>
                                <span className="text-[10px] text-slate-500">{o.packageName}</span>
                              </td>
                              <td className="px-5 py-4 text-center text-slate-400 font-mono">
                                {latestRefund.errorDate ? formatDateShort(latestRefund.errorDate) : formatDateShort(latestRefund.createdAt)}
                              </td>
                              <td className="px-5 py-4 text-rose-400 font-bold font-mono">
                                {formatCurrency(latestRefund.amount)}
                              </td>
                              <td className="px-5 py-4 text-purple-300 font-bold font-mono">
                                {formatCurrency(latestRefund.sourceRefundExpected || 0)}
                              </td>
                              <td className="px-5 py-4 text-emerald-400 font-bold font-mono">
                                {formatCurrency(latestRefund.sourceRefundActual || 0)}
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Source Refund Summary card */}
              <div className="p-5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 space-y-3.5 text-xs h-fit">
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
          )}
        </div>
      </div>
    </div>
  );
}
