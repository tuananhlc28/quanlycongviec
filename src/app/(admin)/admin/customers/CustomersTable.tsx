'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Phone, MessageCircle, RotateCcw, Trash2, Loader2, X, AlertTriangle, Edit2, Plus, Search, ExternalLink, Download, Copy, Check, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCurrency, getCustomerTagConfig, getCreditRatingConfig } from '@/lib/utils';

const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

interface CustomerWithOrders {
  id: string;
  name: string;
  phone: string | null;
  facebook: string | null;
  telegram: string | null;
  zalo: string | null;
  note: string | null;
  tag: string;
  creditRating: string;
  status: string;
  renewalsCount: number;
  isDeleted: boolean;
  deletedAt: Date | string | null;
  createdAt: Date | string;
  orders: {
    createdAt: Date | string;
    status: string;
    paymentStatus: string;
    paidAmount: number;
    packageName: string;
    salePrice: number;
    costPrice: number;
    profit: number;
    paymentDueDate?: Date | string | null;
    service?: {
      id: string;
      name: string;
      logo: string | null;
    } | null;
    refundHistories: {
      amount: number;
      sourceRefundActual?: number;
      sourceRefundExpected?: number;
      sourceAmount?: number;
    }[];
  }[];
}

interface CustomersTableProps {
  initialCustomers: CustomerWithOrders[];
}

export default function CustomersTable({ initialCustomers }: CustomersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSegment = searchParams.get('segment') || '';

  const [activeTab, setActiveTab] = useState<'active' | 'deleted'>('active');
  const [search, setSearch] = useState('');
  
  // Filter States
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Sorting States
  const [sortBy, setSortBy] = useState('spent'); // spent, revenue, profit, debt, orders, renewals, warranties
  const [sortDirection, setSortDirection] = useState('desc'); // desc, asc

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Modal states
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithOrders | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [facebook, setFacebook] = useState('');
  const [telegram, setTelegram] = useState('');
  const [zalo, setZalo] = useState('');
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('NEW');
  const [status, setStatus] = useState('ACTIVE');
  const [modalLoading, setModalLoading] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerWithOrders | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy state helper
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(value);
    toast.success(`Đã sao chép ${label}`);
    setTimeout(() => setCopiedValue(null), 2000);
  };

  // Timeline States
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineCustomer, setTimelineCustomer] = useState<CustomerWithOrders | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);

  const handleOpenTimeline = async (customer: CustomerWithOrders) => {
    setTimelineCustomer(customer);
    setTimelineLoading(true);
    setTimelineModalOpen(true);
    setTimelineEvents([]);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`);
      if (res.ok) {
        const fullCustomer = await res.json();
        const events: any[] = [];
        
        // 1. Customer creation event
        events.push({
          date: new Date(fullCustomer.createdAt),
          title: '👤 Tạo tài khoản khách hàng',
          description: `Khởi tạo thông tin khách hàng ${fullCustomer.name} trên CRM.`,
          icon: '👤',
          color: 'text-indigo-400 bg-indigo-500/10'
        });

        // 2. Orders purchase events
        fullCustomer.orders.forEach((o: any) => {
          events.push({
            date: new Date(o.createdAt),
            title: `🛒 Mua ${o.service?.name || 'Dịch vụ'} (${o.packageName})`,
            description: `Tạo đơn hàng ${o.orderCode}. Giá bán: ${formatCurrency(o.salePrice)}. Giá vốn: ${formatCurrency(o.costPrice)}. Tài khoản: ${o.accountEmail || '—'}`,
            icon: '🛒',
            color: 'text-emerald-400 bg-emerald-500/10'
          });

          // 3. Refund histories events (báo lỗi & hoàn tiền)
          o.refundHistories.forEach((r: any) => {
            if (r.errorDate) {
              events.push({
                date: new Date(r.errorDate),
                title: `🛠 Báo lỗi ${o.service?.name || 'Dịch vụ'}`,
                description: `Ghi nhận sự cố bảo hành đơn ${o.orderCode}. Lý do: ${r.note || 'Không ghi chú'}.`,
                icon: '🛠',
                color: 'text-blue-400 bg-blue-500/10'
              });
            }
            events.push({
              date: new Date(r.createdAt),
              title: `💸 Hoàn tiền ${o.service?.name || 'Dịch vụ'}`,
              description: `Hoàn khách: -${formatCurrency(r.amount)}. Nguồn hoàn thực tế: +${formatCurrency(r.sourceRefundActual || r.sourceAmount || 0)}. Lợi nhuận sau hoàn: ${formatCurrency(r.netProfitAfterRefund || 0)}.`,
              icon: '💸',
              color: 'text-rose-400 bg-rose-500/10'
            });
          });
        });

        // 4. Activity Logs events (such as RENEW_ORDER or updates)
        if (fullCustomer.activityLogs) {
          fullCustomer.activityLogs.forEach((log: any) => {
            if (log.action === 'RENEW_ORDER') {
              events.push({
                date: new Date(log.createdAt),
                title: '🔄 Gia hạn dịch vụ',
                description: log.details || 'Gia hạn gói dịch vụ.',
                icon: '🔄',
                color: 'text-amber-400 bg-amber-500/10'
              });
            }
          });
        }

        // Sort events descending
        events.sort((a, b) => b.date.getTime() - a.date.getTime());
        setTimelineEvents(events);
      } else {
        toast.error('Không thể tải lịch sử timeline');
      }
    } catch {
      toast.error('Lỗi kết nối khi tải timeline');
    } finally {
      setTimelineLoading(false);
    }
  };

  // 1. Calculate stats dynamically per customer, including classification & recency
  const processedCustomers = useMemo(() => {
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;

    return initialCustomers.map(c => {
      let totalOrders = c.orders.length;
      let totalSpent = 0; // Chi tiêu = Tổng tiền đã thanh toán
      let totalRevenue = 0; // Doanh thu = Tổng giá bán
      let totalRefund = 0;
      let totalProfit = 0;
      let lastPurchaseDate: Date | null = null;
      let latestOrderServiceAndPackage = '—';

      // Sort customer orders by date to find the latest
      const sortedOrders = [...c.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latestOrder = sortedOrders[0];
      if (latestOrder) {
        latestOrderServiceAndPackage = `${latestOrder.service?.logo || '🔑'} ${latestOrder.service?.name || 'Dịch vụ'} (${latestOrder.packageName})`;
        lastPurchaseDate = new Date(latestOrder.createdAt);
      }

      let currentDebt = 0;
      let warrantiesCount = 0;

      for (const o of c.orders) {
        totalSpent += o.paidAmount;
        totalRevenue += o.salePrice;
        if (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'OVERDUE') {
          currentDebt += Math.max(0, o.salePrice - o.paidAmount);
        }
        
        const orderRefunds = o.refundHistories ? o.refundHistories.reduce((sum, r) => sum + r.amount, 0) : 0;
        const orderSourceRefunds = o.refundHistories ? o.refundHistories.reduce((sum, r) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0) : 0;
        
        totalProfit += (o.salePrice - o.costPrice) - orderRefunds + orderSourceRefunds;
        totalRefund += orderRefunds;
        warrantiesCount += o.refundHistories ? o.refundHistories.length : 0;
      }

      // Calculate relative recency string
      let recencyText = 'Chưa mua hàng';
      let daysSinceLastPurchase = 9999;
      if (lastPurchaseDate) {
        const diffMs = now.getTime() - lastPurchaseDate.getTime();
        daysSinceLastPurchase = Math.floor(diffMs / msInDay);
        if (daysSinceLastPurchase <= 0) {
          recencyText = 'Hôm nay';
        } else if (daysSinceLastPurchase === 1) {
          recencyText = 'Hôm qua';
        } else {
          recencyText = `${daysSinceLastPurchase} ngày trước`;
        }
      }

      // Dynamic Classification Badge
      let badgeLabel = '🟡 Khách mới';
      let badgeStyle = 'bg-amber-500/10 text-amber-500 border border-amber-500/20';

      if (daysSinceLastPurchase >= 90 && lastPurchaseDate) {
        badgeLabel = '🔴 90 ngày chưa mua';
        badgeStyle = 'bg-red-500/10 text-red-500 border border-red-500/20';
      } else if (daysSinceLastPurchase >= 60 && lastPurchaseDate) {
        badgeLabel = '🔴 60 ngày chưa mua';
        badgeStyle = 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
      } else if (daysSinceLastPurchase >= 30 && lastPurchaseDate) {
        badgeLabel = '🔴 30 ngày chưa mua';
        badgeStyle = 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
      } else if (totalSpent >= 5000000 || totalOrders >= 5) {
        badgeLabel = '🟣 VIP';
        badgeStyle = 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      } else if (totalOrders >= 2) {
        badgeLabel = '🔵 Khách quen';
        badgeStyle = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      }

      return {
        ...c,
        lastPurchaseDate,
        recencyText,
        daysSinceLastPurchase,
        latestOrderServiceAndPackage,
        badge: {
          label: badgeLabel,
          style: badgeStyle,
        },
        stats: {
          totalOrders,
          totalSpent,
          totalRevenue,
          totalRefund,
          totalProfit,
          currentDebt,
          warrantiesCount,
        }
      };
    });
  }, [initialCustomers]);

  // 2. Filter list based on tab, search, tags, ratings, and status
  const filteredCustomers = useMemo(() => {
    // Reset to page 1 whenever filters change
    setCurrentPage(1);

    const filtered = processedCustomers.filter((c) => {
      const matchesTab = activeTab === 'active' ? !c.isDeleted : c.isDeleted;
      if (!matchesTab) return false;

      // Filter by custom tags
      if (selectedTag && c.tag !== selectedTag) return false;

      // Filter by credit rating S/A/B/C/D/NEW
      if (selectedRating && c.creditRating !== selectedRating) return false;

      // Filter by status (Hoạt động, Tạm khóa, VIP)
      if (selectedStatus) {
        if (selectedStatus === 'ACTIVE' && c.status !== 'ACTIVE') return false;
        if (selectedStatus === 'LOCKED' && c.status !== 'LOCKED') return false;
        if (selectedStatus === 'VIP' && c.status !== 'VIP') return false;
      }

      if (!search) return true;
      const term = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.facebook && c.facebook.toLowerCase().includes(term)) ||
        (c.telegram && c.telegram.toLowerCase().includes(term)) ||
        (c.zalo && c.zalo.toLowerCase().includes(term)) ||
        (c.note && c.note.toLowerCase().includes(term))
      );
    });

    // Sort by selected metric
    return filtered.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'spent') {
        valA = a.stats.totalSpent;
        valB = b.stats.totalSpent;
      } else if (sortBy === 'revenue') {
        valA = a.stats.totalRevenue;
        valB = b.stats.totalRevenue;
      } else if (sortBy === 'profit') {
        valA = a.stats.totalProfit;
        valB = b.stats.totalProfit;
      } else if (sortBy === 'debt') {
        valA = a.stats.currentDebt;
        valB = b.stats.currentDebt;
      } else if (sortBy === 'orders') {
        valA = a.stats.totalOrders;
        valB = b.stats.totalOrders;
      } else if (sortBy === 'renewals') {
        valA = a.renewalsCount || 0;
        valB = b.renewalsCount || 0;
      } else if (sortBy === 'warranties') {
        valA = a.stats.warrantiesCount;
        valB = b.stats.warrantiesCount;
      }

      if (sortDirection === 'asc') {
        return valA - valB;
      } else {
        return valB - valA;
      }
    });
  }, [processedCustomers, activeTab, search, selectedTag, selectedRating, selectedStatus, sortBy, sortDirection]);

  // 3. Slice for client-side pagination
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(startIndex, startIndex + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Handle open add/edit modal
  const handleOpenModal = (customer: any | null = null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setName(customer.name);
      setPhone(customer.phone || '');
      setFacebook(customer.facebook || '');
      setTelegram(customer.telegram || '');
      setZalo(customer.zalo || '');
      setNote(customer.note || '');
      setTag(customer.tag || 'NEW');
      setStatus(customer.status || 'ACTIVE');
    } else {
      setName('');
      setPhone('');
      setFacebook('');
      setTelegram('');
      setZalo('');
      setNote('');
      setTag('NEW');
      setStatus('ACTIVE');
    }
    setCustomerModalOpen(true);
  };

  // Submit add/edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên khách hàng');
      return;
    }

    setModalLoading(true);
    try {
      const url = selectedCustomer 
        ? `/api/admin/customers/${selectedCustomer.id}` 
        : `/api/admin/customers`;
      const method = selectedCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, facebook, telegram, zalo, note, tag, status }),
      });

      if (res.ok) {
        toast.success(selectedCustomer ? 'Cập nhật thành công!' : 'Tạo mới thành công!');
        setCustomerModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi mạng, vui lòng thử lại');
    } finally {
      setModalLoading(false);
    }
  };

  // Open delete
  const handleOpenDelete = (customer: CustomerWithOrders) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  // Submit soft delete
  const handleDelete = async () => {
    if (!customerToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Đã chuyển khách hàng vào kho lưu trữ');
        setDeleteModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Xóa thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Restore
  const handleRestore = async (customer: CustomerWithOrders) => {
    if (!confirm(`Khôi phục hoạt động cho khách hàng ${customer.name}?`)) return;

    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESTORE' }),
      });

      if (res.ok) {
        toast.success('Khôi phục khách hàng thành công!');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Khôi phục thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  // Export to CSV helper
  const handleExportCSV = () => {
    const headers = ['Tên Khách Hàng', 'Số Điện Thoại', 'Facebook', 'Telegram', 'Zalo', 'Số Đơn', 'Tổng Chi Tiêu', 'Hoàn Tiền', 'Lợi Nhuận', 'Ghi Chú'];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.phone || '',
      c.facebook || '',
      c.telegram || '',
      c.zalo || '',
      c.stats.totalOrders,
      c.stats.totalSpent,
      c.stats.totalRefund,
      c.stats.totalProfit,
      c.note || '',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CRM_KhachHang_${activeTab}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const segmentLabels: Record<string, string> = {
    '30_days': 'Khách 30 ngày chưa mua',
    '60_days': 'Khách 60 ngày chưa mua',
    '90_days': 'Khách 90 ngày chưa mua',
    'vip': 'Khách hàng VIP',
    'regular': 'Khách quen',
    'new': 'Khách mới',
  };

  const handleClearSegment = () => {
    router.push('/admin/customers');
  };

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);

  return (
    <div className="space-y-4">
      {/* Header filter & search */}
      <div className="bg-[#131722]/50 p-4 rounded-2xl border border-white/5 space-y-4">
        <div className="flex flex-col xl:flex-row gap-4 justify-between items-center">
          <div className="relative w-full xl:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, Facebook, Telegram, Zalo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
            {/* Tag Filter */}
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- Tất cả Tag --</option>
              <option value="NEW">Mới (NEW)</option>
              <option value="REGULAR">Quen (REGULAR)</option>
              <option value="VIP">VIP</option>
              <option value="DAI_LY">Đại lý</option>
              <option value="SPAM">Spam</option>
              <option value="KHACH_NO">Khách nợ</option>
              <option value="THAN_THIET">Thân thiết</option>
              <option value="INACTIVE_30">30 ngày chưa mua</option>
              <option value="INACTIVE_60">60 ngày chưa mua</option>
              <option value="INACTIVE_90">90 ngày chưa mua</option>
            </select>

            {/* Credit Rating Filter */}
            <select
              value={selectedRating}
              onChange={(e) => setSelectedRating(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- Điểm uy tín --</option>
              <option value="S">S (Xuất sắc)</option>
              <option value="A">A (Tốt)</option>
              <option value="B">B (Trung bình)</option>
              <option value="C">C (Yếu)</option>
              <option value="D">D (Tệ)</option>
              <option value="NEW">NEW (Mới)</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#131722] border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- Trạng thái --</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Tạm khóa</option>
              <option value="VIP">VIP</option>
            </select>

            <div className="flex gap-2 whitespace-nowrap">
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm khách hàng
              </button>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
                title="Xuất danh sách lọc"
              >
                <Download className="w-4 h-4" />
                Xuất Excel
              </button>
            </div>
          </div>
        </div>

        {/* Sorting Controls */}
        <div className="flex flex-wrap gap-3 items-center border-t border-white/5 pt-3">
          <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Sắp xếp theo:</span>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#131722] border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="spent">Tổng chi tiêu</option>
            <option value="revenue">Tổng doanh thu</option>
            <option value="profit">Tổng lợi nhuận thực</option>
            <option value="debt">Công nợ hiện tại</option>
            <option value="orders">Tổng số đơn hàng</option>
            <option value="renewals">Số lần gia hạn</option>
            <option value="warranties">Số lần bảo hành</option>
          </select>

          <select
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#131722] border border-white/10 text-slate-300 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="desc">Cao nhất (Giảm dần)</option>
            <option value="asc">Thấp nhất (Tăng dần)</option>
          </select>
        </div>
      </div>

      {/* Segment Filter Notice */}
      {activeSegment && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-indigo-400">
          <span>🔍 Đang lọc phân loại: <strong>{segmentLabels[activeSegment] || activeSegment}</strong></span>
          <button
            onClick={handleClearSegment}
            className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Bỏ lọc
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Khách hàng hoạt động
        </button>
        <button
          onClick={() => setActiveTab('deleted')}
          className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'deleted'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          Kho lưu trữ (Đã xóa)
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-4 text-center w-12">STT</th>
              <th className="px-6 py-4">Họ tên / Phân loại / Uy tín</th>
              <th className="px-6 py-4">Tổng đơn</th>
              <th className="px-6 py-4">Tổng chi tiêu</th>
              <th className="px-6 py-4">Đang nợ</th>
              <th className="px-6 py-4">Hoàn khách</th>
              <th className="px-6 py-4">Lợi nhuận thực</th>
              <th className="px-6 py-4">Đơn gần nhất</th>
              <th className="px-6 py-4">Mua gần nhất</th>
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-300">
            {paginatedCustomers.map((c, index) => {
              const tagCfg = getCustomerTagConfig(c.tag || 'NEW');
              const ratingCfg = getCreditRatingConfig(c.creditRating || 'B');
              const hasContact = c.phone || c.zalo || c.facebook || c.telegram;

              return (
                <tr key={c.id} className="hover:bg-white/2 transition-colors table-row-hover">
                  <td className="px-4 py-4 text-center text-slate-500 font-mono text-xs">
                    {(currentPage - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 font-medium">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <Link href={`/admin/customers/${c.id}`} className="font-semibold text-indigo-400 hover:underline transition-colors cursor-pointer">
                          {c.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pl-10">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${tagCfg.color}`}>
                          {tagCfg.emoji} {tagCfg.label}
                        </span>
                        <div className="relative group inline-block">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help ${ratingCfg.color}`}>
                            Uy tín: {ratingCfg.label} ❓
                          </span>
                          <div className="absolute left-0 bottom-6 hidden group-hover:block w-72 bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-2xl z-50 text-[11px] leading-relaxed text-slate-300 space-y-2 font-normal text-left">
                            <p className="font-bold text-white border-b border-slate-700 pb-1">Giải nghĩa xếp hạng uy tín:</p>
                            <p><span className="font-bold text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded">A+</span> Thanh toán luôn đúng hạn. Không nợ. Khách VIP.</p>
                            <p><span className="font-bold text-blue-400 bg-blue-500/10 px-1 py-0.2 rounded">A</span> Rất uy tín. Hiếm khi thanh toán trễ.</p>
                            <p><span className="font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded">B</span> Thỉnh thoảng thanh toán trễ. Có thể bán tiếp.</p>
                            <p><span className="font-bold text-orange-400 bg-orange-500/10 px-1 py-0.2 rounded">C</span> Thường xuyên thanh toán trễ. Cần theo dõi.</p>
                            <p><span className="font-bold text-red-400 bg-red-500/10 px-1 py-0.2 rounded">D</span> Nợ nhiều. Thanh toán rất chậm. Hạn chế giao trước.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">{c.stats.totalOrders} đơn</td>
                  <td className="px-6 py-4 font-bold text-white text-xs">{formatCurrency(c.stats.totalSpent)}</td>
                  <td className={`px-6 py-4 text-xs ${c.stats.currentDebt > 0 ? 'font-bold text-rose-400' : 'text-slate-500'}`}>
                    {c.stats.currentDebt > 0 ? formatCurrency(c.stats.currentDebt) : '—'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-rose-400 text-xs">{formatCurrency(c.stats.totalRefund)}</td>
                  <td className={`px-6 py-4 font-bold text-xs ${c.stats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(c.stats.totalProfit)}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-indigo-300">
                    <div className="max-w-[180px] truncate" title={c.latestOrderServiceAndPackage}>
                      {c.latestOrderServiceAndPackage}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {activeTab === 'active' ? (
                        <>
                          <button
                            onClick={() => handleOpenTimeline(c)}
                            className="btn-compact font-semibold"
                            title="Lịch sử Timeline"
                          >
                            <Clock className="w-3 h-3" /> Timeline
                          </button>
                          <button
                            onClick={() => handleOpenModal(c)}
                            className="btn-compact btn-compact-primary font-semibold"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-3 h-3" /> Sửa
                          </button>
                          <button
                            onClick={() => handleOpenDelete(c)}
                            className="btn-compact btn-compact-danger font-semibold"
                            title="Xóa mềm"
                          >
                            <Trash2 className="w-3 h-3" /> Xóa
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleRestore(c)}
                          className="btn-compact btn-compact-success font-semibold"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Khôi phục
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-slate-500 text-sm">
                  Không tìm thấy khách hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
          >
            Trang trước
          </button>
          <span className="text-xs text-slate-400">
            Trang <strong className="text-white">{currentPage}</strong> / {totalPages} (Tổng {filteredCustomers.length} khách)
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-30 cursor-pointer text-slate-300"
          >
            Trang sau
          </button>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white">
            <button
              onClick={() => setCustomerModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">
              {selectedCustomer ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Họ tên */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Họ tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* SĐT */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Facebook Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Facebook Link / Username
                </label>
                <input
                  type="text"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="Ví dụ: fb.com/username"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Telegram Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Telegram Username
                </label>
                <input
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="Ví dụ: @username"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Zalo Username/SĐT */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Zalo SĐT / Username
                </label>
                <input
                  type="text"
                  value={zalo}
                  onChange={(e) => setZalo(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none"
                />
              </div>

              {/* Tag Phân Loại */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Tag Phân Loại
                </label>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-white/10 text-white text-sm focus:border-indigo-500 transition-all focus:outline-none cursor-pointer"
                >
                  <option value="NEW">Mới (NEW)</option>
                  <option value="REGULAR">Quen (REGULAR)</option>
                  <option value="VIP">VIP</option>
                  <option value="DAI_LY">Đại lý</option>
                  <option value="SPAM">Spam</option>
                  <option value="KHACH_NO">Khách nợ</option>
                  <option value="THAN_THIET">Thân thiết</option>
                  <option value="INACTIVE_30">30 ngày chưa mua</option>
                  <option value="INACTIVE_60">60 ngày chưa mua</option>
                  <option value="INACTIVE_90">90 ngày chưa mua</option>
                </select>
              </div>

              {/* Trạng thái (Chỉ khi sửa) */}
              {selectedCustomer && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Trạng thái
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#131722] border border-white/10 text-white text-sm focus:border-indigo-500 transition-all focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">🟢 Hoạt động</option>
                    <option value="LOCKED">🔴 Tạm khóa</option>
                    <option value="VIP">🟣 VIP</option>
                  </select>
                </div>
              )}

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Ghi chú
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập ghi chú sở thích, nhu cầu khách..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all focus:outline-none resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
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
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Soft Delete Modal */}
      {deleteModalOpen && customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-center text-white">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mt-4">Xác nhận Lưu trữ</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn chuyển khách hàng <strong className="text-white">{customerToDelete.name}</strong> vào Kho lưu trữ?
              Thông tin đơn hàng của khách hàng này sẽ được giữ lại để thống kê tài chính.
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

      {/* Timeline Modal / Drawer */}
      {timelineModalOpen && timelineCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg h-full p-6 bg-[#131722] border-l border-white/10 shadow-2xl flex flex-col text-white">
            <button
              onClick={() => setTimelineModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6 pr-8">
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Lịch sử hoạt động</span>
              <h2 className="text-xl font-bold text-white mt-1 truncate">Timeline: {timelineCustomer.name}</h2>
              {timelineCustomer.phone && <p className="text-xs text-slate-400 mt-1">SĐT: {timelineCustomer.phone}</p>}
            </div>

            {timelineLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400">Đang tải timeline...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/10">
                {timelineEvents.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-12">Không có sự kiện nào được ghi nhận</p>
                ) : (
                  timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative pl-10 flex gap-3 items-start group">
                      {/* Timeline dot */}
                      <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-4 ring-[#131722] ${evt.color}`}>
                        {evt.icon}
                      </div>

                      {/* Content card */}
                      <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-all">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold text-white">{evt.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                            {new Date(evt.date).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">
                          {evt.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setTimelineModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

