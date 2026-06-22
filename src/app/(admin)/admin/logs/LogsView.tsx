'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  X, 
  Loader2, 
  RefreshCw, 
  ArrowLeft, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LogsViewProps {
  services: { id: string; name: string }[];
  sources: { id: string; name: string }[];
}

const actionTypes = [
  { value: 'CREATE_ORDER', label: 'Tạo đơn hàng' },
  { value: 'UPDATE_ORDER', label: 'Cập nhật đơn' },
  { value: 'RENEW_ORDER', label: 'Gia hạn đơn' },
  { value: 'WARRANTY_ORDER', label: 'Báo lỗi đơn' },
  { value: 'RESOLVE_WARRANTY', label: 'Xử lý lỗi đơn' },
  { value: 'REFUND_ORDER', label: 'Hoàn tiền đơn' },
  { value: 'DELETE_ORDER', label: 'Xóa đơn hàng' },
  { value: 'CREATE_CUSTOMER', label: 'Tạo khách hàng' },
  { value: 'UPDATE_CUSTOMER', label: 'Sửa khách hàng' },
  { value: 'DELETE_CUSTOMER', label: 'Xóa khách hàng' },
  { value: 'CREATE_SERVICE', label: 'Tạo dịch vụ' },
  { value: 'UPDATE_SERVICE', label: 'Cập nhật dịch vụ' },
  { value: 'CREATE_SOURCE', label: 'Tạo nguồn hàng' },
  { value: 'UPDATE_SOURCE', label: 'Cập nhật nguồn' },
];

export default function LogsView({ services, sources }: LogsViewProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters State
  const [filterAction, setFilterAction] = useState('');
  const [searchOrderCode, setSearchOrderCode] = useState('');
  const [searchCustomerName, setSearchCustomerName] = useState('');
  const [filterServiceId, setFilterServiceId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('');

  // Fetch Activity Logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        action: filterAction,
        orderCode: searchOrderCode,
        customerName: searchCustomerName,
        serviceId: filterServiceId,
        supplierId: filterSupplierId,
        startDate,
        endDate,
      }).toString();

      const res = await fetch(`/api/admin/logs?${q}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalLogs(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        toast.error('Lỗi khi tải nhật ký thao tác');
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setLoadingLogs(false);
    }
  }, [page, filterAction, searchOrderCode, searchCustomerName, filterServiceId, filterSupplierId, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Date Preset handler
  const handlePreset = (preset: string) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    setActivePreset(preset);

    const formatDateString = (d: Date) => {
      return d.toISOString().split('T')[0];
    };

    switch (preset) {
      case 'today':
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '3days':
        start.setDate(start.getDate() - 2);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '7days':
        start.setDate(start.getDate() - 6);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '30days':
        start.setDate(start.getDate() - 29);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '3months':
        start.setMonth(start.getMonth() - 3);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '6months':
        start.setMonth(start.getMonth() - 6);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case '1year':
        start.setFullYear(start.getFullYear() - 1);
        setStartDate(formatDateString(start));
        setEndDate(formatDateString(end));
        break;
      case 'all':
      case 'clear':
        setStartDate('');
        setEndDate('');
        setActivePreset(preset === 'clear' ? '' : 'all');
        break;
    }
    setPage(1);
  };

  const handleClearAllFilters = () => {
    setFilterAction('');
    setSearchOrderCode('');
    setSearchCustomerName('');
    setFilterServiceId('');
    setFilterSupplierId('');
    setStartDate('');
    setEndDate('');
    setActivePreset('');
    setPage(1);
  };

  return (
    <div className="space-y-6 text-white animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-indigo-400" />
          📋 Nhật ký hệ thống
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-medium">
          Xem nhật ký các hành động của Quản trị viên và thông tin kiểm toán bảo hành, đơn hàng.
        </p>
      </div>

      <div className="space-y-4">
        {/* Advanced Filter Panel */}
        <div className="bg-[#131722]/50 p-4 rounded-2xl border border-white/5 space-y-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Thời gian nhanh:</span>
            {['today', '3days', '7days', '30days', '3months', '6months', '1year', 'all'].map((preset) => {
              const labels: Record<string, string> = {
                today: 'Hôm nay',
                '3days': '3 ngày',
                '7days': '7 ngày',
                '30days': '30 ngày',
                '3months': '3 tháng',
                '6months': '6 tháng',
                '1year': '1 năm',
                'all': 'Tất cả',
              };
              return (
                <button
                  key={preset}
                  onClick={() => handlePreset(preset)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all border cursor-pointer ${
                    activePreset === preset
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
            {activePreset && (
              <button
                onClick={() => handlePreset('clear')}
                className="px-2 py-1 text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg flex items-center gap-1 hover:bg-red-500/20 transition-all cursor-pointer font-semibold"
              >
                <X className="w-3 h-3" /> Hủy lọc thời gian
              </button>
            )}
          </div>

          {/* Inputs & Dropdowns Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pt-2 border-t border-white/5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Loại thao tác</span>
              <select
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-xs focus:border-indigo-500 outline-none"
              >
                <option value="">Tất cả thao tác</option>
                {actionTypes.map(at => (
                  <option key={at.value} value={at.value}>{at.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Mã đơn hàng</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchOrderCode}
                  onChange={(e) => { setSearchOrderCode(e.target.value); setPage(1); }}
                  placeholder="Mã đơn..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Khách hàng</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchCustomerName}
                  onChange={(e) => { setSearchCustomerName(e.target.value); setPage(1); }}
                  placeholder="Tên khách..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-xs focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Dịch vụ</span>
              <select
                value={filterServiceId}
                onChange={(e) => { setFilterServiceId(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-xs focus:border-indigo-500 outline-none"
              >
                <option value="">Tất cả dịch vụ</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Nguồn hàng</span>
              <select
                value={filterSupplierId}
                onChange={(e) => { setFilterSupplierId(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-xs focus:border-indigo-500 outline-none"
              >
                <option value="">Tất cả nguồn hàng</option>
                {sources.map(src => (
                  <option key={src.id} value={src.id}>{src.name}</option>
                ))}
              </select>
            </div>

            {/* Date Custom range inputs */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Tùy chỉnh khoảng ngày</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); setPage(1); }}
                  className="px-2 py-1.5 rounded-lg bg-[#131722] border border-white/10 text-white text-[10px] w-full focus:outline-none focus:border-indigo-500"
                  title="Từ ngày"
                />
                <span className="text-slate-500 text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); setPage(1); }}
                  className="px-2 py-1.5 rounded-lg bg-[#131722] border border-white/10 text-white text-[10px] w-full focus:outline-none focus:border-indigo-500"
                  title="Đến ngày"
                />
              </div>
            </div>
          </div>

          {/* Clear filters trigger */}
          <div className="flex justify-between items-center pt-2.5 border-t border-white/5 text-xs text-slate-500">
            <div>
              Tổng số bản ghi: <strong className="text-slate-300 font-bold">{totalLogs}</strong>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearAllFilters}
                className="text-slate-400 hover:text-white transition-all cursor-pointer underline text-[11px]"
              >
                Xóa tất cả bộ lọc
              </button>
              <button 
                onClick={fetchLogs}
                className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
            </div>
          </div>
        </div>

        {/* Logs Timeline */}
        <div className="space-y-4">
          {loadingLogs ? (
            <div className="p-20 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span>Đang tải nhật ký kiểm toán hệ thống...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-20 text-center text-slate-500 text-xs border border-white/5 rounded-2xl bg-white/2">
              Không tìm thấy bản ghi nhật ký nào thỏa mãn bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {logs.map((log: any) => {
                const isWarranty = log.action === 'WARRANTY_ORDER';
                const isRefund = log.action === 'REFUND_ORDER' || log.action === 'PENDING_REFUND_ORDER';
                const isDelete = log.action === 'DELETE_ORDER';
                
                let actionBadge = 'bg-white/5 text-slate-400';
                if (isWarranty) actionBadge = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                else if (isRefund) actionBadge = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
                else if (isDelete) actionBadge = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                else if (log.action === 'CREATE_ORDER') actionBadge = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                return (
                  <div key={log.id} className="p-3.5 rounded-xl bg-white/2 border border-white/5 space-y-2 hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="font-semibold text-slate-400 flex items-center gap-1">
                        👤 {log.user?.name || 'Hệ thống'}
                      </span>
                      <span>{new Date(log.createdAt).toLocaleTimeString('vi-VN')} {new Date(log.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-200 text-xs leading-relaxed font-semibold">{log.details}</p>
                    <div className="flex justify-between items-center pt-2 border-t border-white/3 text-[9px] text-slate-500 font-mono">
                      <span className={`px-1.5 py-0.5 rounded ${actionBadge}`}>{log.action}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loadingLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
              >
                <ArrowLeft className="w-4 h-4" />
                Trang trước
              </button>
              <span className="text-xs text-slate-400">
                Trang <strong className="text-white">{page}</strong> / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loadingLogs}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
              >
                Trang sau
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
