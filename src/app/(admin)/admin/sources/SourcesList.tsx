'use client';

import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Loader2, X, AlertTriangle, Send, MessageCircle, Mail, FileText, TrendingUp, DollarSign, Plug, ShieldCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import SourceDebtView from './SourceDebtView';

interface SupplierSourceWithStats {
  id: string;
  name: string;
  telegram: string | null;
  zalo: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: Date | string;
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

interface SourcesListProps {
  initialSources: SupplierSourceWithStats[];
}

export default function SourcesList({ initialSources }: SourcesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'debt'>('list');

  const sourceStats = useMemo(() => {
    let totalOrders = 0;
    let totalErrors = 0;
    let totalExpectedRefund = 0;
    let totalActualRefund = 0;
    let totalRemainingDebt = 0;
    let totalRejectedRefund = 0;

    initialSources.forEach(s => {
      totalOrders += s.stats.totalOrders;
      totalErrors += s.stats.totalErrors;
      totalExpectedRefund += s.stats.totalSourceRefundExpected;
      totalActualRefund += s.stats.totalSourceRefundActual;
      totalRemainingDebt += s.stats.netDebt;
      totalRejectedRefund += s.stats.totalSourceRefundRejected;
    });

    return {
      totalOrders,
      totalErrors,
      totalExpectedRefund,
      totalActualRefund,
      totalRemainingDebt,
      totalRejectedRefund,
      avgErrorRate: totalOrders > 0 ? Math.round((totalErrors / totalOrders) * 100) : 0
    };
  }, [initialSources]);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<SupplierSourceWithStats | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [telegram, setTelegram] = useState('');
  const [zalo, setZalo] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Filter list
  const filteredSources = useMemo(() => {
    if (!search) return initialSources;
    const term = search.toLowerCase();
    return initialSources.filter(
      s => s.name.toLowerCase().includes(term) || (s.note && s.note.toLowerCase().includes(term))
    );
  }, [initialSources, search]);

  const openAddModal = () => {
    setEditingSource(null);
    setName('');
    setTelegram('');
    setZalo('');
    setEmail('');
    setNote('');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (src: SupplierSourceWithStats) => {
    setEditingSource(src);
    setName(src.name);
    setTelegram(src.telegram || '');
    setZalo(src.zalo || '');
    setEmail(src.email || '');
    setNote(src.note || '');
    setIsActive(src.isActive);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Vui lòng điền tên nguồn hàng');
      return;
    }

    setFormLoading(true);
    try {
      const url = editingSource
        ? `/api/admin/sources/${editingSource.id}`
        : '/api/admin/sources';
      const method = editingSource ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          telegram: telegram || null,
          zalo: zalo || null,
          email: email || null,
          note: note || null,
          isActive,
        }),
      });

      if (res.ok) {
        toast.success(editingSource ? 'Đã cập nhật nguồn hàng' : 'Đã thêm nguồn hàng mới');
        setModalOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Đã xảy ra lỗi kết nối');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (src: SupplierSourceWithStats) => {
    if (!confirm(`Bạn có chắc muốn xóa nguồn hàng "${src.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/sources/${src.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Đã xóa nguồn hàng thành công');
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Xóa thất bại');
      }
    } catch {
      toast.error('Đã xảy ra lỗi kết nối');
    }
  };

  return (
    <div className="space-y-6">
      {/* Source Dashboard Stats (#36) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl bg-[#1a1f2e]/40 border border-white/5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tổng đơn nhập</p>
          <p className="text-xl font-bold text-white mt-1">{sourceStats.totalOrders} đơn</p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <p className="text-[10px] text-rose-400 uppercase tracking-wider font-semibold">Tổng đơn lỗi</p>
          <p className="text-xl font-bold text-rose-400 mt-1">{sourceStats.totalErrors} đơn ({sourceStats.avgErrorRate}%)</p>
        </div>
        <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10">
          <p className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">Dự kiến hoàn</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{formatCurrency(sourceStats.totalExpectedRefund)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Đã hoàn trả</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(sourceStats.totalActualRefund)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Nguồn còn nợ</p>
          <p className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(sourceStats.totalRemainingDebt)}</p>
        </div>
        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
          <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold">Từ chối hoàn</p>
          <p className="text-xl font-bold text-red-400 mt-1">{formatCurrency(sourceStats.totalRejectedRefund)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 space-x-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'list'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔌 Danh sách nguồn
        </button>
        <button
          onClick={() => setActiveTab('debt')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'debt'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          💸 Công nợ nguồn
        </button>
      </div>

      {activeTab === 'list' ? (
        <>
          {/* Control bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#131722]/50 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm kiếm nguồn hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
          />
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Thêm nguồn hàng
        </button>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSources.map((src) => (
          <div
            key={src.id}
            className={`p-6 rounded-2xl bg-[#1a1f2e]/40 border transition-all card-hover flex flex-col justify-between ${
              src.isActive ? 'border-white/5' : 'border-red-500/20 opacity-70'
            }`}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Link href={`/admin/sources/${src.id}`} className="hover:text-indigo-400 hover:underline transition-colors">
                      {src.name}
                    </Link>
                    {!src.isActive && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold">
                        Tạm Ngưng
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Ngày tạo: {new Date(src.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => openEditModal(src)}
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-all cursor-pointer"
                    title="Sửa"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(src)}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-2 text-xs text-slate-400 bg-white/2 p-3.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    Telegram:
                  </span>
                  <span className="text-white font-medium">
                    {src.telegram ? (
                      <a href={`https://t.me/${src.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                        {src.telegram}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Zalo:
                  </span>
                  <span className="text-white font-medium">
                    {src.zalo ? (
                      <a href={`https://zalo.me/${src.zalo}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                        {src.zalo}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-purple-400" />
                    Email:
                  </span>
                  <span className="text-white font-medium truncate max-w-[150px]" title={src.email || ''}>
                    {src.email ? (
                      <a href={`mailto:${src.email}`} className="text-purple-400 hover:underline">
                        {src.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </div>

              {/* CRM Metrics grid */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tiền nhập hàng</p>
                  <p className="text-xs font-bold text-white mt-1">{formatCurrency(src.stats.totalCost)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Đơn liên kết</p>
                  <p className="text-xs font-bold text-white mt-1">{src.stats.totalOrders} đơn</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Số đơn lỗi</p>
                  <p className="text-xs font-bold text-white mt-1">{src.stats.totalErrors} đơn</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${src.stats.errorRate > 10 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold flex items-center justify-center gap-1">
                    Tỷ lệ lỗi
                    {src.stats.errorRate > 10 ? <AlertTriangle className="w-3 h-3 text-rose-400" /> : <ShieldCheck className="w-3 h-3 text-emerald-400" />}
                  </p>
                  <p className={`text-xs font-bold mt-1 ${src.stats.errorRate > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {src.stats.errorRate}%
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn phải hoàn</p>
                  <p className="text-xs font-semibold text-purple-300 mt-1">{formatCurrency(src.stats.totalSourceRefundExpected)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn đã hoàn</p>
                  <p className="text-xs font-semibold text-emerald-400 mt-1">{formatCurrency(src.stats.totalSourceRefundActual)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn từ chối hoàn</p>
                  <p className="text-xs font-semibold text-rose-400 mt-1">{formatCurrency(src.stats.totalSourceRefundRejected)}</p>
                </div>
                <div className={`p-2.5 rounded-xl border ${src.stats.netDebt > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-white/2 border-white/5'}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Nguồn còn nợ</p>
                  <p className={`text-xs font-bold mt-1 ${src.stats.netDebt > 0 ? 'text-amber-400 font-extrabold' : 'text-white'}`}>{formatCurrency(src.stats.netDebt)}</p>
                </div>
                <div className="col-span-2 p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Lợi nhuận ròng</p>
                  <p className="text-sm font-bold text-cyan-400 mt-1">{formatCurrency(src.stats.totalProfit)}</p>
                </div>
              </div>
            </div>

            {src.note && (
              <div className="mt-4 pt-3 border-t border-white/5 text-xs text-slate-500 leading-relaxed italic flex items-start gap-1.5">
                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <span className="line-clamp-2">Ghi chú: {src.note}</span>
              </div>
            )}
          </div>
        ))}

        {filteredSources.length === 0 && (
          <div className="col-span-full text-center py-20 rounded-2xl bg-[#131722]/30 border border-white/5">
            <Plug className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-sm font-semibold text-white mb-1">Không tìm thấy nguồn hàng nào</h3>
            <p className="text-xs text-slate-500">Điều chỉnh bộ lọc tìm kiếm hoặc bấm nút "Thêm nguồn hàng".</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">
              {editingSource ? 'Chỉnh sửa nguồn hàng' : 'Thêm nguồn hàng mới'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tên */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Tên nguồn hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguồn Canva Partner, Telegram Admin..."
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <Send className="w-3 h-3 text-sky-400" />
                    Telegram
                  </label>
                  <input
                    type="text"
                    value={telegram}
                    onChange={(e) => setTelegram(e.target.value)}
                    placeholder="@username"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Zalo
                  </label>
                  <input
                    type="text"
                    value={zalo}
                    onChange={(e) => setZalo(e.target.value)}
                    placeholder="SĐT Zalo"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3 text-purple-400" />
                  Email liên hệ
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="supplier@email.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Ghi chú nguồn hàng
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú về chu kỳ cấp tài khoản, giá vốn, chính sách bảo hành..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none resize-none"
                />
              </div>

              {/* Hoạt động */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveSource"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#131722] cursor-pointer"
                />
                <label htmlFor="isActiveSource" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                  Kích hoạt hoạt động cho nguồn hàng này
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu nguồn hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : (
        <SourceDebtView />
      )}
    </div>
  );
}
