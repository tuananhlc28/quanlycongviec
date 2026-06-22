'use client';

import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Loader2, X, AlertTriangle, Search, Sparkles, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

interface ServiceWithStats {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  serviceType: string | null;
  defaultSalePrice: number;
  defaultCostPrice: number;
  defaultDurationDays: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalRefund: number;
    avgCostPrice: number;
    avgSalePrice: number;
  };
}

interface ServicesListProps {
  initialServices: ServiceWithStats[];
}

export default function ServicesList({ initialServices }: ServicesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  
  // Modals
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceWithStats | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [logo, setLogo] = useState('🔑');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [defaultSalePrice, setDefaultSalePrice] = useState('');
  const [defaultCostPrice, setDefaultCostPrice] = useState('');
  const [defaultDurationDays, setDefaultDurationDays] = useState('30');
  const [sortOrder, setSortOrder] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceWithStats | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Auto-generate slug from name
  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!selectedService) {
      setSlug(generateSlug(val));
    }
  };

  // Filter services
  const filteredServices = useMemo(() => {
    if (!search) return initialServices;
    const term = search.toLowerCase();
    return initialServices.filter(
      s => s.name.toLowerCase().includes(term) || (s.description && s.description.toLowerCase().includes(term))
    );
  }, [initialServices, search]);

  const handleOpenModal = (service: ServiceWithStats | null = null) => {
    setSelectedService(service);
    if (service) {
      setName(service.name);
      setSlug(service.slug);
      setLogo(service.logo || '🔑');
      setDescription(service.description || '');
      setServiceType(service.serviceType || '');
      setDefaultSalePrice(service.defaultSalePrice?.toString() || '0');
      setDefaultCostPrice(service.defaultCostPrice?.toString() || '0');
      setDefaultDurationDays((service.defaultDurationDays || 30).toString());
      setSortOrder(service.sortOrder.toString());
      setIsActive(service.isActive);
    } else {
      setName('');
      setSlug('');
      setLogo('🔑');
      setDescription('');
      setServiceType('');
      setDefaultSalePrice('');
      setDefaultCostPrice('');
      setDefaultDurationDays('30');
      setSortOrder('');
      setIsActive(true);
    }
    setServiceModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }

    setModalLoading(true);
    try {
      const url = selectedService 
        ? `/api/admin/services/${selectedService.id}` 
        : `/api/admin/services`;
      const method = selectedService ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          logo,
          description,
          serviceType,
          defaultSalePrice: defaultSalePrice === '' ? 0 : parseFloat(defaultSalePrice),
          defaultCostPrice: defaultCostPrice === '' ? 0 : parseFloat(defaultCostPrice),
          defaultDurationDays: parseInt(defaultDurationDays),
          sortOrder: sortOrder === '' ? 0 : parseInt(sortOrder),
          isActive,
        }),
      });

      if (res.ok) {
        toast.success(selectedService ? 'Cập nhật dịch vụ thành công' : 'Thêm dịch vụ thành công');
        setServiceModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Không thể kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenDelete = (service: ServiceWithStats) => {
    setServiceToDelete(service);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!serviceToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/services/${serviceToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Đã xóa dịch vụ thành công');
        setDeleteModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Xóa dịch vụ thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[#131722]/50 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm kiếm dịch vụ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
          />
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Thêm dịch vụ mới
        </button>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredServices.map((s) => (
          <div
            key={s.id}
            className="p-6 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all card-hover flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <Link href={`/admin/services/${s.id}`} className="flex items-center gap-3 hover:text-indigo-400 transition-colors group cursor-pointer">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl group-hover:border-indigo-500/40 transition-all flex-shrink-0">
                    {s.logo || '🔑'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight group-hover:text-indigo-400 transition-all">{s.name}</h3>
                    <div className="flex flex-wrap gap-1 items-center mt-1">
                      <p className="text-[10px] text-slate-500 font-mono">Slug: {s.slug}</p>
                      {s.serviceType && (
                        <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[9px] font-bold">
                          {s.serviceType}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                    s.isActive
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-red-400 bg-red-500/10 border-red-500/20'
                  }`}>
                    {s.isActive ? 'Bán' : 'Tắt'}
                  </span>
                  <button
                    onClick={() => handleOpenModal(s)}
                    className="p-1.5 rounded-lg text-indigo-400 hover:text-white hover:bg-indigo-500/20 transition-all cursor-pointer focus:outline-none"
                    title="Sửa"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleOpenDelete(s)}
                    className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer focus:outline-none"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {s.description && (
                <p className="text-xs text-slate-400 mt-4 leading-relaxed line-clamp-2 italic">{s.description}</p>
              )}

              {/* Mặc định cấu hình */}
              <div className="mt-3 p-3 rounded-xl bg-white/2 border border-white/5 space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Giá bán mặc định:</span>
                  <strong className="text-white font-semibold">{formatCurrency(s.defaultSalePrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Giá vốn mặc định:</span>
                  <strong className="text-slate-300 font-semibold">{formatCurrency(s.defaultCostPrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Thời hạn mặc định:</span>
                  <strong className="text-indigo-400 font-semibold">{s.defaultDurationDays} ngày</strong>
                </div>
              </div>

              {/* CRM service stats */}
              <div className="grid grid-cols-2 gap-3 my-5">
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Tổng Đơn</p>
                  <p className="text-sm font-bold text-white mt-1">{s.stats.totalOrders} đơn</p>
                </div>
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Doanh thu</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{formatCurrency(s.stats.totalRevenue)}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Hoàn tiền</p>
                  <p className="text-sm font-bold text-rose-400 mt-1">{formatCurrency(s.stats.totalRefund)}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/2 border border-white/5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Lợi nhuận</p>
                  <p className="text-sm font-bold text-cyan-400 mt-1">{formatCurrency(s.stats.totalProfit)}</p>
                </div>
              </div>

              {/* Average prices */}
              <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  Giá vốn TB: <strong className="text-slate-300 font-bold">{formatCurrency(s.stats.avgCostPrice)}</strong>
                </span>
                <span className="text-slate-400">
                  Giá bán TB: <strong className="text-white font-bold">{formatCurrency(s.stats.avgSalePrice)}</strong>
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/5 text-[10px] text-slate-500">
              <span>Được tạo ngày: {new Date(s.createdAt).toLocaleDateString('vi-VN')}</span>
              <span>Độ ưu tiên: {s.sortOrder}</span>
            </div>
          </div>
        ))}

        {filteredServices.length === 0 && (
          <div className="col-span-full text-center py-20 rounded-2xl bg-[#131722]/30 border border-white/5">
            <Package className="w-12 h-12 text-slate-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-sm font-semibold text-white mb-1">Không tìm thấy dịch vụ nào</h3>
            <p className="text-xs text-slate-500">Điều chỉnh từ khóa tìm kiếm hoặc bấm nút "Thêm dịch vụ mới".</p>
          </div>
        )}
      </div>

      {/* Service Modal */}
      {serviceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white">
            <button
              onClick={() => setServiceModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">
              {selectedService ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Tên dịch vụ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ví dụ: Canva Pro, Claude Pro..."
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Loại dịch vụ
                  </label>
                  <input
                    type="text"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    placeholder="Ví dụ: Canva, ChatGPT"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Thời hạn mặc định
                  </label>
                  <select
                    value={defaultDurationDays}
                    onChange={(e) => setDefaultDurationDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-white/10 text-white text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  >
                    <option value="30">30 ngày</option>
                    <option value="60">60 ngày</option>
                    <option value="90">90 ngày</option>
                    <option value="180">180 ngày</option>
                    <option value="365">365 ngày</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Giá bán mặc định (VND)
                  </label>
                  <input
                    type="number"
                    value={defaultSalePrice}
                    onChange={(e) => setDefaultSalePrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Giá vốn mặc định (VND)
                  </label>
                  <input
                    type="number"
                    value={defaultCostPrice}
                    onChange={(e) => setDefaultCostPrice(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Slug (Dùng làm định dạng URL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="Ví dụ: canva-pro, claude-pro"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Logo / Emoji
                  </label>
                  <input
                    type="text"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                    placeholder="Ví dụ: 🎨, popcorn, 🤖"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Thứ tự sắp xếp
                  </label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    placeholder="Ví dụ: 1, 2"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Mô tả dịch vụ
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả thông tin chi tiết dịch vụ..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#131722] cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                  Kích hoạt hoạt động cho dịch vụ này
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setServiceModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-center text-white">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mt-4">Xác nhận xóa dịch vụ</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn xóa dịch vụ <strong className="text-white">{serviceToDelete.name}</strong>?
              Hành động này sẽ ẩn dịch vụ và giữ dữ liệu liên quan để báo cáo thống kê.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
