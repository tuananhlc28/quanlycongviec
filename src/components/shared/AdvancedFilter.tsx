'use client';

import { useState } from 'react';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface AdvancedFilterProps {
  // Search
  search: string;
  setSearch: (val: string) => void;
  searchPlaceholder?: string;

  // Select Options
  services?: { id: string; name: string }[];
  selectedService?: string;
  setSelectedService?: (val: string) => void;

  supplierSources?: { id: string; name: string }[];
  selectedSource?: string;
  setSelectedSource?: (val: string) => void;

  statuses?: { value: string; label: string }[];
  selectedStatus?: string;
  setSelectedStatus?: (val: string) => void;

  paymentStatuses?: { value: string; label: string }[];
  selectedPaymentStatus?: string;
  setSelectedPaymentStatus?: (val: string) => void;

  // Dates
  dateStart: string;
  setDateStart: (val: string) => void;
  dateEnd: string;
  setDateEnd: (val: string) => void;

  // Actions
  onReset: () => void;
}

export default function AdvancedFilter({
  search,
  setSearch,
  searchPlaceholder = 'Tìm kiếm...',
  services = [],
  selectedService = '',
  setSelectedService,
  supplierSources = [],
  selectedSource = '',
  setSelectedSource,
  statuses = [],
  selectedStatus = '',
  setSelectedStatus,
  paymentStatuses = [],
  selectedPaymentStatus = '',
  setSelectedPaymentStatus,
  dateStart,
  setDateStart,
  dateEnd,
  setDateEnd,
  onReset,
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count active filters
  let activeFiltersCount = 0;
  if (search) activeFiltersCount++;
  if (selectedService) activeFiltersCount++;
  if (selectedSource) activeFiltersCount++;
  if (selectedStatus) activeFiltersCount++;
  if (selectedPaymentStatus) activeFiltersCount++;
  if (dateStart || dateEnd) activeFiltersCount++;

  const handleQuickPreset = (days: number) => {
    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - days);

    const f = (d: Date) => d.toISOString().split('T')[0];
    setDateStart(f(start));
    setDateEnd(f(now));
  };

  const handleReset = () => {
    onReset();
  };

  return (
    <div className="bg-[#131722]/40 rounded-2xl border border-white/5 overflow-hidden transition-all">
      {/* Summary / Toggle Header */}
      <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Bộ lọc nâng cao</span>
            {activeFiltersCount > 0 && (
              <span className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center animate-pulse">
                {activeFiltersCount}
              </span>
            )}
            {isOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          {/* Quick status pill display */}
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
            {selectedService && (
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">Dịch vụ hoạt động</span>
            )}
            {selectedSource && (
              <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">Nguồn hoạt động</span>
            )}
            {selectedStatus && (
              <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">Trạng thái lọc</span>
            )}
            {selectedPaymentStatus && (
              <span className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400">Thanh toán</span>
            )}
          </div>
        </div>

        {/* Reset button */}
        {activeFiltersCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      <div className={`transition-all duration-300 ${isOpen ? 'max-h-[600px] border-t border-white/5 opacity-100 p-4 space-y-4' : 'max-h-0 opacity-0 pointer-events-none'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Custom Date Range */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Từ ngày</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#131722]/60 border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Đến ngày</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#131722]/60 border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Lọc nhanh thời gian</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Hôm nay', days: 0 },
                { label: '3 ngày', days: 3 },
                { label: '7 ngày', days: 7 },
                { label: '30 ngày', days: 30 },
                { label: '90 ngày', days: 90 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleQuickPreset(preset.days)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-bold text-slate-300 transition-all cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Service Option */}
          {setSelectedService && services.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Dịch vụ</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Source Option */}
          {setSelectedSource && supplierSources.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Nguồn hàng</label>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Tất cả nguồn hàng</option>
                {supplierSources.map(src => (
                  <option key={src.id} value={src.id}>{src.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Option */}
          {setSelectedStatus && statuses.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Trạng thái đơn</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Tất cả trạng thái</option>
                {statuses.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment Status Option */}
          {setSelectedPaymentStatus && paymentStatuses.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Thanh toán</label>
              <select
                value={selectedPaymentStatus}
                onChange={(e) => setSelectedPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-white text-xs focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Tất cả thanh toán</option>
                {paymentStatuses.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
