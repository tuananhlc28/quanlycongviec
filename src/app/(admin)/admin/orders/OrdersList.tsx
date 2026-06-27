'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Search, Plus, Download, X, Eye, EyeOff, Edit2, Calendar, DollarSign, Plug, Sparkles, Loader2, ArrowRight, ShoppingCart, ShieldAlert, RotateCcw, AlertTriangle, CheckCircle2, MessageCircle, ExternalLink, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, getPaymentStatusColor, getPaymentStatusLabel } from '@/lib/utils';
import AdvancedFilter from '@/components/shared/AdvancedFilter';
import CountdownBadge from '@/components/shared/CountdownBadge';
import StatusChangePopup, { StatusOption } from '@/components/shared/StatusChangePopup';
import ColumnVisibilityToggle from '@/components/shared/ColumnVisibilityToggle';
import { saveColumnVisibility, loadColumnVisibility, filterByTimeRange } from '@/lib/tableUtils';
import { TimeRange, DateRange } from '@/components/shared/TimeFilterDropdown';
import StickyBottomActionBar from '@/components/shared/StickyBottomActionBar';

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  facebook: string | null;
  telegram: string | null;
  zalo: string | null;
  orders?: {
    paymentStatus: string;
    paymentDueDate: Date | string | null;
    salePrice: number;
    paidAmount: number;
  }[];
}

interface SupplierSourceProduct {
  id: string;
  supplierSourceId: string;
  packageId: string;
  costPrice: number;
  stock: number;
  deliveryMethod: string;
}

interface ServicePackage {
  id: string;
  serviceId: string;
  name: string;
  durationDays: number;
  salePrice: number;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  supplierSourceProducts?: SupplierSourceProduct[];
}

interface Service {
  id: string;
  name: string;
  logo: string | null;
  serviceType?: string | null;
  defaultSalePrice?: number;
  defaultCostPrice?: number;
  defaultDurationDays?: number;
  packages?: ServicePackage[];
}

interface SupplierSource {
  id: string;
  name: string;
}

interface RefundHistory {
  id: string;
  amount: number;
  daysUsed: number;
  daysRemaining: number;
  costPerDay: number;
  errorDate: string | Date | null;
  createdAt: string | Date;
}

interface OrderRow {
  id: string;
  orderCode: string;
  customerId: string;
  customer: Customer;
  serviceId: string;
  service: Service;
  packageName: string;
  durationDays: number;
  accountEmail: string | null;
  accountPassword: string | null;
  recoveryCode: string | null;
  loginLink: string | null;
  accountNote: string | null;
  supplierSourceId: string | null;
  supplierSourceName: string | null;
  salePrice: number;
  costPrice: number;
  profit: number;
  paymentStatus: string;
  paymentDueDate: Date | string | null;
  paidAt: Date | string | null;
  paidAmount: number;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  refundHistories: RefundHistory[];
  isUnlocked?: boolean;
  unlockReason?: string | null;
}

interface OrdersListProps {
  initialOrders: OrderRow[];
  customers: Customer[];
  services: Service[];
  supplierSources: SupplierSource[];
  currentUser?: any;
}

export default function OrdersList({
  initialOrders,
  customers,
  services,
  supplierSources,
  currentUser,
}: OrdersListProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);

  const clickTimeoutRef = useRef<any>(null);
  const handleEmailClick = (e: React.MouseEvent, email: string, password?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      const copyText = password ? `${email}\n${password}` : email;
      navigator.clipboard.writeText(copyText);
      toast.success('Đã sao chép Email + Password');
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        navigator.clipboard.writeText(email);
        toast.success('Đã sao chép Email');
      }, 250);
    }
  };

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);
  const searchParams = useSearchParams();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');

  // Time Filter States
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  // Status Change Popup States
  const [statusPopupOpen, setStatusPopupOpen] = useState(false);
  const [statusPopupOrder, setStatusPopupOrder] = useState<OrderRow | null>(null);

  // Column Visibility States
  const COLUMNS_CONFIG = [
    { id: 'orderCode', label: 'Mã đơn' },
    { id: 'customer', label: 'Khách hàng' },
    { id: 'service', label: 'Dịch vụ & Gói' },
    { id: 'account', label: 'Tài khoản' },
    { id: 'salePrice', label: 'Giá bán' },
    { id: 'costPrice', label: 'Giá vốn' },
    { id: 'profit', label: 'Lợi nhuận' },
    { id: 'createdAt', label: 'Ngày tạo' },
    { id: 'startDate', label: 'Ngày mua / Kích hoạt' },
    { id: 'paidAt', label: 'Ngày thanh toán' },
    { id: 'endDate', label: 'Ngày hết hạn' },
    { id: 'remaining', label: 'Thời hạn còn lại' },
    { id: 'status', label: 'Trạng thái' },
    { id: 'payment', label: 'Thanh toán' }
  ];
  const DEFAULT_COLUMNS = ['orderCode', 'customer', 'service', 'account', 'salePrice', 'profit', 'endDate', 'remaining', 'status', 'payment'];
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  useEffect(() => {
    const saved = loadColumnVisibility('admin_orders_columns');
    setVisibleColumns(saved.length > 0 ? saved : DEFAULT_COLUMNS);
  }, []);

  const handleToggleColumn = (colId: string) => {
    const next = visibleColumns.includes(colId)
      ? visibleColumns.filter(id => id !== colId)
      : [...visibleColumns, colId];
    setVisibleColumns(next);
    saveColumnVisibility('admin_orders_columns', next);
  };

  // Password visibility maps
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Active item for quick action modals
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [warrantyModalOpen, setWarrantyModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  // --- Create Order Form State ---
  const [formCustomerId, setFormCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerFacebook, setNewCustomerFacebook] = useState('');
  const [newCustomerTelegram, setNewCustomerTelegram] = useState('');
  const [newCustomerZalo, setNewCustomerZalo] = useState('');
  const [newCustomerNote, setNewCustomerNote] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formPackageName, setFormPackageName] = useState('Gói 30 ngày');
  const [formDurationDays, setFormDurationDays] = useState('30');
  const [formSupplierSourceId, setFormSupplierSourceId] = useState('');
  const [formAccountEmail, setFormAccountEmail] = useState('');
  const [formAccountPassword, setFormAccountPassword] = useState('');
  const [formRecoveryCode, setFormRecoveryCode] = useState('');
  const [formLoginLink, setFormLoginLink] = useState('');
  const [formAccountNote, setFormAccountNote] = useState('');
  const [formSalePrice, setFormSalePrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formNote, setFormNote] = useState('');
  const [formPaymentStatus, setFormPaymentStatus] = useState('PAID');

  // Auto detect selected customer's overdue debt (#71)
  const selectedCustomerOverdueDebt = useMemo(() => {
    if (!formCustomerId || formCustomerId === 'new') return null;
    const customerObj = customers.find(c => c.id === formCustomerId);
    if (!customerObj || !customerObj.orders) return null;

    const now = new Date();
    const overdueOrders = customerObj.orders.filter(o => {
      if (o.paymentStatus === 'OVERDUE') return true;
      if (o.paymentStatus === 'UNPAID' && o.paymentDueDate) {
        return now > new Date(o.paymentDueDate);
      }
      return false;
    });

    if (overdueOrders.length === 0) return null;

    const totalOverdueAmount = overdueOrders.reduce((sum, o) => sum + (o.salePrice - o.paidAmount), 0);
    return {
      count: overdueOrders.length,
      amount: totalOverdueAmount,
    };
  }, [formCustomerId, customers]);

  useEffect(() => {
    if (selectedCustomerOverdueDebt) {
      toast.error(
        `Cảnh báo: Khách hàng này đang có ${selectedCustomerOverdueDebt.count} đơn hàng nợ quá hạn với tổng số tiền ${formatCurrency(selectedCustomerOverdueDebt.amount)}!`,
        { duration: 6000 }
      );
    }
  }, [selectedCustomerOverdueDebt]);

  // --- Edit Order Form State ---
  const [editServiceId, setEditServiceId] = useState('');
  const [editPackageName, setEditPackageName] = useState('');
  const [editDurationDays, setEditDurationDays] = useState('');
  const [editSupplierSourceId, setEditSupplierSourceId] = useState('');
  const [editAccountEmail, setEditAccountEmail] = useState('');
  const [editAccountPassword, setEditAccountPassword] = useState('');
  const [editRecoveryCode, setEditRecoveryCode] = useState('');
  const [editLoginLink, setEditLoginLink] = useState('');
  const [editAccountNote, setEditAccountNote] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');

  // --- Renew Form State ---
  const [renewDays, setRenewDays] = useState('30');
  const [renewSalePrice, setRenewSalePrice] = useState('');
  const [renewCostPrice, setRenewCostPrice] = useState('');
  const [renewNote, setRenewNote] = useState('');

  // --- Warranty Form State ---
  const [warrantyErrorDate, setWarrantyErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [warrantyReason, setWarrantyReason] = useState('');
  const [warrantyNote, setWarrantyNote] = useState('');

  // --- Refund Form State ---
  const [refundErrorDate, setRefundErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [refundReason, setRefundReason] = useState('');
  const [refundOverrideAmount, setRefundOverrideAmount] = useState('');
  const [refundOverrideSourceRefundActual, setRefundOverrideSourceRefundActual] = useState('');
  const [overrideSourceRefund, setOverrideSourceRefund] = useState(false);
  const [refundTargetStatus, setRefundTargetStatus] = useState<'PENDING_REFUND' | 'REFUNDED'>('REFUNDED');

  // Checkbox selection states
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [openPaymentMenuId, setOpenPaymentMenuId] = useState<string | null>(null);

  // Sort states
  const [sortCol, setSortCol] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (col: string) => {
    if (sortCol !== col) {
      setSortCol(col);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortCol('');
      setSortDir(null);
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <span className="ml-1 text-slate-500 hover:text-slate-300">⇅</span>;
    if (sortDir === 'asc') return <span className="ml-1 text-indigo-400">▲</span>;
    return <span className="ml-1 text-indigo-400">▼</span>;
  };

  // Batch actions modals state
  const [batchSourceModalOpen, setBatchSourceModalOpen] = useState(false);
  const [batchRenewModalOpen, setBatchRenewModalOpen] = useState(false);
  const [batchPaymentModalOpen, setBatchPaymentModalOpen] = useState(false);
  const [batchConfirmRefundModalOpen, setBatchConfirmRefundModalOpen] = useState(false);
  const [batchSourceId, setBatchSourceId] = useState('');
  const [batchRenewDays, setBatchRenewDays] = useState('30');
  const [batchRenewSalePrice, setBatchRenewSalePrice] = useState('');
  const [batchRenewCostPrice, setBatchRenewCostPrice] = useState('');
  const [batchRenewNote, setBatchRenewNote] = useState('');
  const [batchPaymentMethod, setBatchPaymentMethod] = useState('BANK_TRANSFER');
  const [batchPaymentNote, setBatchPaymentNote] = useState('');
  const [batchSourceRefundActual, setBatchSourceRefundActual] = useState('');
  const [batchSourceStatus, setBatchSourceStatus] = useState('REFUNDED');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResultsReport, setBatchResultsReport] = useState<{
    success: number;
    failed: number;
    total: number;
    errors: any[];
  } | null>(null);

  // Batch refund preview modal
  const [batchRefundModalOpen, setBatchRefundModalOpen] = useState(false);
  const [batchRefundErrorDate, setBatchRefundErrorDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchRefundReason, setBatchRefundReason] = useState('Hoàn tiền hàng loạt');

  const batchRefundPreviews = useMemo(() => {
    if (selectedOrderIds.length === 0) return { list: [], totalClientRefund: 0, totalSourceRefund: 0, totalProfitAfter: 0 };
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    const faultDate = new Date(batchRefundErrorDate);

    let totalClientRefund = 0;
    let totalSourceRefund = 0;
    let totalProfitAfter = 0;

    const list = selectedOrders.map(o => {
      const start = new Date(o.startDate);
      const totalDays = o.durationDays || 30;
      const diffTime = faultDate.getTime() - start.getTime();
      let daysUsed = Math.floor(diffTime / (24 * 60 * 60 * 1000));
      if (daysUsed < 0) daysUsed = 0;
      if (daysUsed > totalDays) daysUsed = totalDays;

      const daysRemaining = totalDays - daysUsed;
      const clientRefund = Math.round((o.salePrice / totalDays) * daysRemaining);
      const sourceRefund = Math.round((o.costPrice / totalDays) * daysRemaining);
      const profitAfter = o.salePrice - o.costPrice - clientRefund + sourceRefund;

      totalClientRefund += clientRefund;
      totalSourceRefund += sourceRefund;
      totalProfitAfter += profitAfter;

      return {
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customer?.name || 'N/A',
        salePrice: o.salePrice,
        costPrice: o.costPrice,
        clientRefund,
        sourceRefund,
        profitAfter,
      };
    });

    return {
      list,
      totalClientRefund,
      totalSourceRefund,
      totalProfitAfter,
    };
  }, [selectedOrderIds, orders, batchRefundErrorDate]);

  const handleToggleAll = () => {
    const pageOrderIds = paginatedOrders.map(o => o.id);
    const allChecked = pageOrderIds.length > 0 && pageOrderIds.every(id => selectedOrderIds.includes(id));
    if (allChecked) {
      setSelectedOrderIds(prev => prev.filter(id => !pageOrderIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pageOrderIds])));
    }
  };

  const handleToggleRow = (orderId: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleQuickSelect = (count: number) => {
    const visibleIds = filteredOrders.slice(0, count).map(o => o.id);
    setSelectedOrderIds(visibleIds);
  };

  const handleBatchAction = async (action: string, payload?: any) => {
    if (selectedOrderIds.length === 0) {
      toast.error('Vui lòng chọn ít nhất một đơn hàng');
      return;
    }

    let confirmMsg = '';
    const numOrders = selectedOrderIds.length;
    if (action === 'DELETE') {
      confirmMsg = `Bạn có chắc chắn muốn XÓA HÀNG LOẠT ${numOrders} đơn hàng này không? Hành động này không thể hoàn tác!`;
    } else if (action === 'RENEW') {
      confirmMsg = `Xác nhận GIA HẠN hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'UPDATE_STATUS') {
      confirmMsg = `Xác nhận THAY ĐỔI TRẠNG THÁI hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'report_error') {
      confirmMsg = `Xác nhận BÁO LỖI hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'CHANGE_SOURCE') {
      confirmMsg = `Xác nhận THAY ĐỔI NGUỒN hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'UPDATE_PAYMENT') {
      confirmMsg = `Xác nhận CẬP NHẬT THANH TOÁN hàng loạt cho ${numOrders} đơn hàng?`;
    } else if (action === 'REFUND') {
      confirmMsg = `Xác nhận HOÀN TIỀN hàng loạt cho ${numOrders} đơn hàng?`;
    } else {
      confirmMsg = `Xác nhận thực hiện thao tác hàng loạt cho ${numOrders} đơn hàng đã chọn?`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    setBatchLoading(true);
    try {
      const url = action === 'report_error' ? '/api/admin/orders/batch-warranty' : '/api/admin/orders/batch';
      const body = action === 'report_error'
        ? { orderIds: selectedOrderIds, action: 'report_error', note: payload?.note }
        : { orderIds: selectedOrderIds, action, payload };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Thao tác hàng loạt hoàn tất!');
        setBatchResultsReport(data);
        setSelectedOrderIds([]);
        setBatchSourceModalOpen(false);
        setBatchRenewModalOpen(false);
        setBatchPaymentModalOpen(false);
        setBatchConfirmRefundModalOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleExportSelectedCSV = () => {
    if (selectedOrderIds.length === 0) return;
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Dịch vụ', 'Gói', 'Thời hạn (ngày)', 'Tài khoản', 'Mật khẩu', 'Giá bán', 'Giá vốn', 'Lợi nhuận', 'Bắt đầu', 'Hết hạn', 'Trạng thái', 'Ghi chú'];
    const rows = selectedOrders.map(o => [
      o.orderCode,
      o.customer?.name || '',
      o.customer?.phone || '',
      o.service?.name || '',
      o.packageName,
      o.durationDays,
      o.accountEmail || '',
      o.accountPassword || '',
      o.salePrice,
      o.costPrice,
      o.profit,
      new Date(o.startDate).toLocaleDateString('vi-VN'),
      new Date(o.endDate).toLocaleDateString('vi-VN'),
      o.status,
      o.note || ''
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CRM_DonHang_Chon_${selectedOrderIds.length}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-fill end date for CREATE form
  useEffect(() => {
    if (formStartDate && formDurationDays) {
      const start = new Date(formStartDate);
      const days = parseInt(formDurationDays);
      if (!isNaN(start.getTime()) && !isNaN(days)) {
        const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
        setFormEndDate(end.toISOString().split('T')[0]);
      }
    }
  }, [formStartDate, formDurationDays]);

  // Auto-fill end date for EDIT form
  useEffect(() => {
    if (editStartDate && editDurationDays) {
      const start = new Date(editStartDate);
      const days = parseInt(editDurationDays);
      if (!isNaN(start.getTime()) && !isNaN(days)) {
        const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
        setEditEndDate(end.toISOString().split('T')[0]);
      }
    }
  }, [editStartDate, editDurationDays]);

  // Open modal if URL search params include create=true
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      openCreateModal();
    }
  }, [searchParams]);

  // Auto-fill from Service defaults in CREATE form
  useEffect(() => {
    if (formServiceId) {
      const selected = services.find(s => s.id === formServiceId);
      if (selected) {
        const defaultDays = selected.defaultDurationDays || 30;
        setFormPackageName(`Gói ${defaultDays} ngày`);
        setFormDurationDays(defaultDays.toString());
        setFormSalePrice(selected.defaultSalePrice?.toString() || '0');
        setFormCostPrice(selected.defaultCostPrice?.toString() || '0');
      }
    }
  }, [formServiceId, services]);

  const openCreateModal = () => {
    setFormCustomerId(customers[0]?.id || 'new');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerFacebook('');
    setNewCustomerTelegram('');
    setNewCustomerZalo('');
    setNewCustomerNote('');
    const firstService = services[0];
    const defaultDays = firstService?.defaultDurationDays || 30;
    setFormServiceId(firstService?.id || '');
    setFormPackageName(`Gói ${defaultDays} ngày`);
    setFormDurationDays(defaultDays.toString());
    setFormSalePrice(firstService?.defaultSalePrice?.toString() || '0');
    setFormCostPrice(firstService?.defaultCostPrice?.toString() || '0');
    setFormSupplierSourceId(supplierSources[0]?.id || '');
    setFormAccountEmail('');
    setFormAccountPassword('');
    setFormRecoveryCode('');
    setFormLoginLink('');
    setFormAccountNote('');
    setFormSalePrice('');
    setFormCostPrice('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate('');
    setFormStatus('ACTIVE');
    setFormNote('');
    setCreateModalOpen(true);
  };

  const openEditModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setEditServiceId(order.serviceId);
    setEditPackageName(order.packageName);
    setEditDurationDays(order.durationDays.toString());
    setEditSupplierSourceId(order.supplierSourceId || '');
    setEditAccountEmail(order.accountEmail || '');
    setEditAccountPassword(order.accountPassword || '');
    setEditRecoveryCode(order.recoveryCode || '');
    setEditLoginLink(order.loginLink || '');
    setEditAccountNote(order.accountNote || '');
    setEditSalePrice(order.salePrice.toString());
    setEditCostPrice(order.costPrice.toString());
    setEditStartDate(new Date(order.startDate).toISOString().split('T')[0]);
    setEditEndDate(new Date(order.endDate).toISOString().split('T')[0]);
    setEditStatus(order.status);
    setEditNote(order.note || '');
    setEditModalOpen(true);
  };

  const openRenewModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setRenewDays('30');
    setRenewSalePrice('');
    setRenewCostPrice('');
    setRenewNote('');
    setRenewModalOpen(true);
  };

  const openWarrantyModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setWarrantyErrorDate(new Date().toISOString().split('T')[0]);
    setWarrantyReason('');
    setWarrantyNote('');
    setWarrantyModalOpen(true);
  };

  const openRefundModal = (order: OrderRow) => {
    setSelectedOrder(order);
    setRefundErrorDate(new Date().toISOString().split('T')[0]);
    setRefundReason('');
    setRefundOverrideAmount('');
    setRefundOverrideSourceRefundActual('');
    setOverrideSourceRefund(false);
    setRefundTargetStatus('REFUNDED');
    setRefundModalOpen(true);
  };

  const togglePasswordVisibility = (orderId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Profit calculated dynamically for CREATE
  const formProfit = useMemo(() => {
    const sale = parseFloat(formSalePrice) || 0;
    const cost = parseFloat(formCostPrice) || 0;
    return sale - cost;
  }, [formSalePrice, formCostPrice]);

  // Profit calculated dynamically for EDIT
  const editProfit = useMemo(() => {
    const sale = parseFloat(editSalePrice) || 0;
    const cost = parseFloat(editCostPrice) || 0;
    return sale - cost;
  }, [editSalePrice, editCostPrice]);

  // Refund computation
  const refundCalculation = useMemo(() => {
    if (!selectedOrder) return { daysUsed: 0, daysRemaining: 0, costPerDay: 0, computedAmount: 0, supplierCostPerDay: 0, computedSourceRefundExpected: 0 };
    const start = new Date(selectedOrder.startDate);
    const totalDays = selectedOrder.durationDays || 30;
    const errorDateObj = refundErrorDate ? new Date(refundErrorDate) : new Date();
    
    const diff = errorDateObj.getTime() - start.getTime();
    let computedDaysUsed = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (computedDaysUsed < 0) computedDaysUsed = 0;
    if (computedDaysUsed > totalDays) computedDaysUsed = totalDays;

    const computedDaysRemaining = totalDays - computedDaysUsed;
    const costPerDay = selectedOrder.salePrice / totalDays;
    const computedRefundAmount = Math.max(0, Math.round(computedDaysRemaining * costPerDay));

    const supplierCostPerDay = selectedOrder.costPrice / totalDays;
    const computedSourceRefundExpected = Math.max(0, Math.round(computedDaysRemaining * supplierCostPerDay));

    return {
      daysUsed: computedDaysUsed,
      daysRemaining: computedDaysRemaining,
      costPerDay,
      computedAmount: computedRefundAmount,
      supplierCostPerDay,
      computedSourceRefundExpected,
    };
  }, [refundErrorDate, selectedOrder]);

  // Profit calculated dynamically after refund
  const dynamicNetProfit = useMemo(() => {
    if (!selectedOrder) return 0;
    const sale = selectedOrder.salePrice;
    const cost = selectedOrder.costPrice;
    const clientRefund = refundOverrideAmount !== '' 
      ? (parseFloat(refundOverrideAmount) || 0)
      : refundCalculation.computedAmount;
    const sourceRefund = overrideSourceRefund
      ? (parseFloat(refundOverrideSourceRefundActual) || 0)
      : refundCalculation.computedSourceRefundExpected;
    return sale - cost - clientRefund + sourceRefund;
  }, [selectedOrder, refundOverrideAmount, refundOverrideSourceRefundActual, overrideSourceRefund, refundCalculation]);

  // Filter local rows
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    if (timeRange !== 'all') {
      let start: Date | null = null;
      let end: Date | null = null;
      if (timeRange === 'custom') {
        if (customStart) start = new Date(customStart);
        if (customEnd) {
          end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
        }
      } else if (dateRange) {
        start = new Date(dateRange.start);
        end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
      }
      filtered = filterByTimeRange(filtered, start, end);
    }

    return filtered.filter((o) => {
      if (search) {
        const term = search.toLowerCase();
        const matchesSearch =
          o.orderCode.toLowerCase().includes(term) ||
          (o.accountEmail && o.accountEmail.toLowerCase().includes(term)) ||
          (o.supplierSourceName && o.supplierSourceName.toLowerCase().includes(term)) ||
          o.customer.name.toLowerCase().includes(term) ||
          (o.customer.phone && o.customer.phone.includes(term)) ||
          (o.customer.facebook && o.customer.facebook.toLowerCase().includes(term)) ||
          (o.customer.telegram && o.customer.telegram.toLowerCase().includes(term)) ||
          (o.customer.zalo && o.customer.zalo.toLowerCase().includes(term)) ||
          o.service.name.toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }
      if (selectedService && o.serviceId !== selectedService) return false;
      if (selectedSource && o.supplierSourceId !== selectedSource) return false;
      if (selectedStatus && o.status !== selectedStatus) return false;
      if (selectedPaymentStatus && o.paymentStatus !== selectedPaymentStatus) return false;
      return true;
    });
  }, [orders, search, selectedService, selectedSource, selectedStatus, selectedPaymentStatus, timeRange, customStart, customEnd, dateRange]);

  // Sort filtered orders
  const sortedOrders = useMemo(() => {
    if (!sortCol || !sortDir) return filteredOrders;
    const sorted = [...filteredOrders];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortCol) {
        case 'createdAt':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'startDate':
          valA = new Date(a.startDate).getTime();
          valB = new Date(b.startDate).getTime();
          break;
        case 'endDate':
          valA = new Date(a.endDate).getTime();
          valB = new Date(b.endDate).getTime();
          break;
        case 'salePrice':
          valA = a.salePrice;
          valB = b.salePrice;
          break;
        case 'costPrice':
          valA = a.costPrice;
          valB = b.costPrice;
          break;
        case 'profit':
          valA = a.profit;
          valB = b.profit;
          break;
        case 'status':
          valA = a.status.toLowerCase();
          valB = b.status.toLowerCase();
          break;
        case 'remaining':
          valA = new Date(a.endDate).getTime() - Date.now();
          valB = new Date(b.endDate).getTime() - Date.now();
          break;
        default:
          return 0;
      }
      if (typeof valA === 'string') return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredOrders, sortCol, sortDir]);

  const totalPages = Math.ceil(sortedOrders.length / pageSize);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedOrders.slice(start, start + pageSize);
  }, [sortedOrders, currentPage, pageSize]);


  // Handle Export CSV
  const handleExportCSV = () => {
    const query = new URLSearchParams({
      search,
      serviceId: selectedService,
      supplierSourceId: selectedSource,
      status: selectedStatus,
      dateStart: customStart || (dateRange?.start ? new Date(dateRange.start).toISOString().split('T')[0] : ''),
      dateEnd: customEnd || (dateRange?.end ? new Date(dateRange.end).toISOString().split('T')[0] : ''),
    }).toString();
    window.open(`/api/admin/orders/export?${query}`, '_blank');
  };

  // Submit new order form
  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formCustomerId === 'new' && !newCustomerName.trim()) {
      toast.error('Vui lòng nhập tên khách hàng mới');
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: formCustomerId,
          newCustomerName,
          newCustomerPhone,
          newCustomerFacebook,
          newCustomerTelegram,
          newCustomerZalo,
          newCustomerNote,
          serviceId: formServiceId,
          packageName: formPackageName,
          durationDays: formDurationDays === '' ? 30 : parseInt(formDurationDays),
          accountEmail: formAccountEmail,
          accountPassword: formAccountPassword.trim(),
          recoveryCode: formRecoveryCode,
          loginLink: formLoginLink,
          accountNote: formAccountNote,
          supplierSourceId: formSupplierSourceId || null,
          salePrice: formSalePrice === '' ? 0 : parseFloat(formSalePrice),
          costPrice: formCostPrice === '' ? 0 : parseFloat(formCostPrice),
          startDate: formStartDate,
          endDate: formEndDate,
          status: formStatus,
          note: formNote,
          paymentStatus: formPaymentStatus,
        }),
      });

      if (res.ok) {
        toast.success('Tạo đơn hàng thành công!');
        setCreateModalOpen(false);
        if (searchParams.get('create') === 'true') {
          router.replace('/admin/orders');
        } else {
          router.refresh();
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit edit order form
  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: editServiceId,
          packageName: editPackageName,
          durationDays: editDurationDays === '' ? 30 : parseInt(editDurationDays),
          supplierSourceId: editSupplierSourceId || null,
          accountEmail: editAccountEmail,
          accountPassword: editAccountPassword,
          recoveryCode: editRecoveryCode,
          loginLink: editLoginLink,
          accountNote: editAccountNote,
          salePrice: editSalePrice === '' ? 0 : parseFloat(editSalePrice),
          costPrice: editCostPrice === '' ? 0 : parseFloat(editCostPrice),
          startDate: editStartDate,
          endDate: editEndDate,
          status: editStatus,
          note: editNote,
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật đơn hàng thành công!');
        setEditModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit renew order form
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!renewDays) {
      toast.error('Vui lòng nhập số ngày gia hạn');
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daysToExtend: parseInt(renewDays),
          additionalSalePrice: renewSalePrice === '' ? 0 : parseFloat(renewSalePrice),
          additionalCostPrice: renewCostPrice === '' ? 0 : parseFloat(renewCostPrice),
          note: renewNote,
        }),
      });

      if (res.ok) {
        toast.success('Gia hạn thuê bao thành công!');
        setRenewModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Gia hạn thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (orderId: string, newStatus: string) => {
    const loadingToast = toast.loading('Đang cập nhật trạng thái thanh toán...');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: newStatus,
          paymentMethod: newStatus === 'PAID' ? 'bank' : undefined,
          paymentNote: newStatus === 'PAID' ? 'Cập nhật thanh toán trực tiếp từ danh sách' : undefined,
        }),
      });
      if (res.ok) {
        toast.success('Cập nhật trạng thái thanh toán thành công!', { id: loadingToast });
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newStatus as any } : o));
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối', { id: loadingToast });
    }
  };

  const handleStatusChangeSubmit = async (data: {
    status: string;
    note: string;
    notifyCustomer: boolean;
    saveHistory: boolean;
  }) => {
    if (!statusPopupOrder) return;
    const loadingToast = toast.loading('Đang cập nhật trạng thái đơn hàng...');
    try {
      const res = await fetch(`/api/admin/orders/${statusPopupOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: data.status,
          note: data.note ? `${statusPopupOrder.note || ''}\n[Cập nhật trạng thái]: ${data.note}`.trim() : undefined,
          notifyCustomer: data.notifyCustomer,
          saveHistory: data.saveHistory,
        }),
      });

      if (res.ok) {
        toast.success('Cập nhật trạng thái thành công!', { id: loadingToast });
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Cập nhật thất bại', { id: loadingToast });
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ', { id: loadingToast });
    }
  };

  // Submit warranty form
  const handleWarrantySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/warranty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: warrantyErrorDate,
          reason: warrantyReason || 'Không có lý do',
          note: warrantyNote,
        }),
      });

      if (res.ok) {
        toast.success('Báo sự cố bảo hành thành công!');
        setWarrantyModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  // Submit refund form
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!refundReason.trim()) {
      toast.error('Vui lòng nhập lý do hoàn tiền');
      return;
    }

    setModalLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorDate: refundErrorDate,
          reason: refundReason,
          overrideAmount: refundOverrideAmount || undefined,
          overrideSourceRefundActual: overrideSourceRefund ? refundOverrideSourceRefundActual : undefined,
          targetStatus: refundTargetStatus,
        }),
      });

      if (res.ok) {
        toast.success('Ghi nhận hoàn tiền thành công!');
        setRefundModalOpen(false);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Hoàn tiền thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn hàng này? Thao tác này không thể hoàn tác và sẽ xóa tất cả dữ liệu liên quan.')) {
      return;
    }
    setDeleteLoadingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Xóa đơn hàng thành công!');
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Xóa đơn hàng thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions bar */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-[#131722]/50 p-4 rounded-2xl border border-white/5">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm KH, SĐT, mã đơn, tài khoản..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <ColumnVisibilityToggle
            columns={COLUMNS_CONFIG}
            visibleColumns={visibleColumns}
            onToggle={handleToggleColumn}
            storageKey="admin_orders_columns"
          />
          <button
            onClick={openCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo đơn mới
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Advanced Filter Component */}
      <AdvancedFilter
        search={search}
        setSearch={setSearch}
        services={services}
        selectedService={selectedService}
        setSelectedService={setSelectedService}
        supplierSources={supplierSources}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        statuses={[
          { value: 'ACTIVE', label: '🟢 Đang sử dụng' },
          { value: 'EXPIRING_SOON', label: '🟡 Sắp hết hạn' },
          { value: 'EXPIRED', label: '🔴 Hết hạn' },
          { value: 'WARRANTY', label: '🔵 Khách báo lỗi' },
          { value: 'WARRANTY_PENDING_SOURCE', label: '🟣 Chờ nguồn hoàn' },
          { value: 'WARRANTY_PENDING_REFUND', label: '🟠 Chờ hoàn khách' },
          { value: 'WARRANTY_DONE', label: '✅ Hoàn tất bảo hành' },
          { value: 'WARRANTY_REJECTED', label: '⛔ Từ chối bảo hành' },
          { value: 'REFUNDED', label: '⚫ Đã hoàn tiền' },
        ]}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        paymentStatuses={[
          { value: 'UNPAID', label: '🔴 Chưa thanh toán' },
          { value: 'PAID', label: '🟢 Đã thanh toán' },
          { value: 'OVERDUE', label: '🔥 Quá hạn' },
        ]}
        selectedPaymentStatus={selectedPaymentStatus}
        setSelectedPaymentStatus={setSelectedPaymentStatus}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        dateRange={dateRange}
        setDateRange={setDateRange}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        onReset={() => {
          setSearch('');
          setSelectedService('');
          setSelectedSource('');
          setSelectedStatus('');
          setSelectedPaymentStatus('');
          setTimeRange('all');
          setDateRange(null);
          setCustomStart('');
          setCustomEnd('');
        }}
      />

      {/* Orders Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#131722]/30">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-4 text-center w-12">
                <input
                  type="checkbox"
                  checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.includes(o.id))}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="px-4 py-4 text-center w-12">STT</th>
              <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('createdAt')}>Mã đơn <SortIcon col="createdAt" /></th>
              <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('customer')}>Khách hàng <SortIcon col="customer" /></th>
              <th className="px-6 py-4">Dịch vụ & Gói</th>
              <th className="px-6 py-4">Tài khoản</th>
              <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('salePrice')}>Tài chính <SortIcon col="salePrice" /></th>
              <th className="px-6 py-4 cursor-pointer select-none hover:text-white transition-colors" onClick={() => handleSort('endDate')}>Thời hạn <SortIcon col="endDate" /></th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Thanh toán</th>
              <th className="px-6 py-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm text-slate-300">
            {paginatedOrders.map((o, idx) => {
              const diff = new Date(o.endDate).getTime() - new Date().getTime();
              const remaining = Math.ceil(diff / (24 * 60 * 60 * 1000));
              const remainingLabel = remaining <= 0 ? 'Hết hạn' : `Còn ${remaining} ngày`;

              return (
                <tr key={o.id} className="hover:bg-white/2 transition-colors table-row-hover">
                  <td className="px-4 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(o.id)}
                      onChange={() => handleToggleRow(o.id)}
                      className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>
                  {/* STT */}
                  <td className="px-4 py-4 text-center font-mono text-slate-500">
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>
                  {/* Mã đơn */}
                  <td className="px-6 py-4">
                    <Link href={`/admin/orders/${o.id}`} className="font-bold text-indigo-400 hover:underline focus:outline-none">
                      {o.orderCode}
                    </Link>
                  </td>

                  {/* Khách hàng */}
                  <td className="px-6 py-4">
                    <div>
                      {o.customer?.id ? (
                        <Link href={`/admin/customers/${o.customer.id}`} className="font-bold text-white hover:text-indigo-400 transition-colors text-sm">
                          {o.customer.name}
                        </Link>
                      ) : (
                        <p className="font-bold text-white text-sm">{o.customer?.name || 'N/A'}</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-0.5">{o.customer?.phone || 'No phone'}</p>
                    </div>
                  </td>

                  {/* Dịch vụ & Gói */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{o.service?.logo || '🔑'}</span>
                      <div>
                        <button
                          onClick={() => setSelectedService(o.serviceId)}
                          className="font-semibold text-white hover:text-indigo-400 hover:underline text-left cursor-pointer focus:outline-none"
                        >
                          {o.service?.name}
                        </button>
                        <p className="text-xs text-slate-500">{o.packageName}</p>
                      </div>
                    </div>
                  </td>

                  {/* Tài khoản credentials */}
                  <td className="px-6 py-4">
                    {o.accountEmail ? (
                      <div className="space-y-1 text-xs max-w-[200px]">
                        <button
                          onClick={(e) => handleEmailClick(e, o.accountEmail!, o.accountPassword || undefined)}
                          className="font-medium text-indigo-400 hover:underline truncate block text-left cursor-pointer focus:outline-none w-full"
                          title="Click 1 lần để copy Email, double click để copy Email + Password"
                        >
                          {o.accountEmail}
                        </button>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="font-mono">
                            {visiblePasswords[o.id] ? o.accountPassword : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(o.id)}
                            className="text-slate-600 hover:text-slate-400 cursor-pointer focus:outline-none"
                          >
                            {visiblePasswords[o.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* Tài chính */}
                  <td className="px-6 py-4 text-xs font-mono">
                    <div className="space-y-0.5 text-left">
                      <p className="text-emerald-400 font-bold">Bán: {formatCurrency(o.salePrice)}</p>
                      <p className="text-slate-400">Vốn/Gốc: {formatCurrency(o.costPrice)}</p>
                      <p className="text-indigo-300 font-bold">Lợi nhuận: {formatCurrency(o.profit)}</p>
                      <p className="text-blue-400">Đã TT: {formatCurrency(o.paidAmount)}</p>
                      {o.salePrice - o.paidAmount > 0 ? (
                        <p className="text-rose-400 font-semibold">Nợ: {formatCurrency(o.salePrice - o.paidAmount)}</p>
                      ) : (
                        <p className="text-slate-500">Nợ: 0đ</p>
                      )}
                      {(() => {
                        const totalRefund = o.refundHistories?.reduce((sum: number, r: any) => sum + r.amount, 0) || 0;
                        return totalRefund > 0 ? (
                          <p className="text-rose-500 font-bold border-t border-white/5 pt-0.5 mt-0.5">Hoàn: {formatCurrency(totalRefund)}</p>
                        ) : null;
                      })()}
                    </div>
                  </td>

                  {/* Thời hạn */}
                  <td className="px-6 py-4 text-xs">
                    <div className="space-y-1 flex flex-col items-start">
                      {(() => {
                        const latestRefund = o.refundHistories && o.refundHistories.length > 0
                          ? [...o.refundHistories].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                          : null;
                        const errorDateVal = latestRefund ? (latestRefund.errorDate || latestRefund.createdAt) : o.updatedAt;
                        return (
                          <CountdownBadge endDate={o.endDate} status={o.status} completedAt={errorDateVal} />
                        );
                      })()}
                    </div>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-6 py-4">
                    {(() => {
                      const isLocked = ['COMPLETED', 'SOURCE_REJECTED'].includes(o.status) && !o.isUnlocked;
                      return (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${isLocked ? 'bg-white/5 text-slate-300 border-white/10' : getStatusColor(o.status)}`}>
                          {isLocked ? '⚪ Đã khóa' : getStatusLabel(o.status)}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Thanh toán */}
                  <td className="px-6 py-4">
                    <div className="relative flex flex-col gap-1.5 min-w-[130px]">
                      <button
                        onClick={() => setOpenPaymentMenuId(openPaymentMenuId === o.id ? null : o.id)}
                        className={`status-badge border text-[11px] cursor-pointer flex items-center justify-between gap-1 w-full text-left ${
                          o.paymentStatus === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : o.paymentStatus === 'OVERDUE'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <span>
                          {o.paymentStatus === 'PAID' ? '🟢 Đã thanh toán' : o.paymentStatus === 'OVERDUE' ? '🔴 Quá hạn' : '🟡 Chưa thanh toán'}
                        </span>
                        <span className="text-[8px] opacity-60">▼</span>
                      </button>

                      {openPaymentMenuId === o.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenPaymentMenuId(null)} />
                          <div className="absolute top-8 left-0 right-0 bg-[#161b26] border border-white/10 rounded-lg shadow-xl py-1 z-20 font-sans">
                            <button
                              onClick={async () => {
                                setOpenPaymentMenuId(null);
                                await handleUpdatePaymentStatus(o.id, 'UNPAID');
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-amber-400 hover:bg-white/5 font-semibold flex items-center gap-1.5"
                            >
                              🟡 Chưa thanh toán
                            </button>
                            <button
                              onClick={async () => {
                                setOpenPaymentMenuId(null);
                                await handleUpdatePaymentStatus(o.id, 'PAID');
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-emerald-400 hover:bg-white/5 font-semibold flex items-center gap-1.5"
                            >
                              🟢 Đã thanh toán
                            </button>
                            <button
                              onClick={async () => {
                                setOpenPaymentMenuId(null);
                                await handleUpdatePaymentStatus(o.id, 'OVERDUE');
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-400 hover:bg-white/5 font-semibold flex items-center gap-1.5"
                            >
                              🔴 Quá hạn
                            </button>
                          </div>
                        </>
                      )}
                      
                      {o.paymentStatus !== 'PAID' && (() => {
                        const now = new Date();
                        const startDate = new Date(o.startDate);
                        const diffTime = Math.max(0, now.getTime() - startDate.getTime());
                        const daysInDebt = Math.floor(diffTime / (24 * 60 * 60 * 1000));
                        return (
                          <span className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 self-start">
                            Đã nợ: {daysInDebt} ngày
                          </span>
                        );
                      })()}
                    </div>
                  </td>

                  {/* Quick actions direct buttons */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap max-w-[280px] mx-auto">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="btn-compact font-semibold border-slate-700/50"
                        title="Xem chi tiết"
                      >
                        👁 Xem
                      </Link>

                      <button
                        onClick={() => openEditModal(o)}
                        className="btn-compact btn-compact-primary font-semibold"
                        title="Chỉnh sửa đơn"
                      >
                        ✏ Sửa
                      </button>

                      {['ACTIVE', 'EXPIRING_SOON', 'EXPIRED'].includes(o.status) && (
                        <>
                          <button
                            onClick={() => openRenewModal(o)}
                            className="btn-compact btn-compact-success font-semibold"
                            title="Gia hạn thuê bao"
                          >
                            🔄 Gia hạn
                          </button>

                          <button
                            onClick={() => openWarrantyModal(o)}
                            className="btn-compact btn-compact-danger font-semibold"
                            title="Báo lỗi/Bảo hành"
                          >
                            🛠 Báo lỗi
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleDeleteOrder(o.id)}
                        disabled={deleteLoadingId === o.id}
                        className="btn-compact btn-compact-danger font-semibold flex items-center justify-center"
                        title="Xóa vĩnh viễn"
                      >
                        {deleteLoadingId === o.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : '🗑 Xóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-slate-500 text-sm">
                  Không tìm thấy đơn hàng nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-white/5 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded bg-[#131722] border border-white/10 text-white text-xs focus:outline-none"
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <span>đơn hàng mỗi trang (Tổng {filteredOrders.length} đơn)</span>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-semibold transition-all"
            >
              Trang trước
            </button>
            <span className="px-3 font-semibold text-white">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer font-semibold transition-all"
            >
              Trang sau
            </button>
          </div>
        )}
      </div>

      <StickyBottomActionBar
        selectedCount={selectedOrderIds.length}
        onClearSelection={() => setSelectedOrderIds([])}
        actions={[
          {
            label: 'Báo sự cố hàng loạt',
            onClick: () => {
              const note = prompt('Nhập lý do báo lỗi hàng loạt (tùy chọn):');
              if (note !== null) {
                handleBatchAction('report_error', { note });
              }
            },
            variant: 'danger' as const,
            disabled: batchLoading,
          },
          ...(isAdmin ? [
            {
              label: 'Hoàn tiền hàng loạt',
              onClick: () => setBatchRefundModalOpen(true),
              variant: 'danger' as const,
              disabled: batchLoading,
            }
          ] : []),
          {
            label: 'Đổi nguồn',
            onClick: () => setBatchSourceModalOpen(true),
            variant: 'primary' as const,
          },
          {
            label: 'Gia hạn',
            onClick: () => setBatchRenewModalOpen(true),
            variant: 'success' as const,
          },
          {
            label: 'Thanh toán',
            onClick: () => setBatchPaymentModalOpen(true),
            variant: 'warning' as const,
          },
          {
            label: 'Cập nhật hoàn nguồn',
            onClick: () => setBatchConfirmRefundModalOpen(true),
            variant: 'purple' as const,
          },
          {
            label: 'Xuất Excel',
            onClick: handleExportSelectedCSV,
            variant: 'secondary' as const,
          }
        ]}
      />

      {/* --- MODAL: BATCH REFUND WITH PREVIEW --- */}
      {batchRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs max-h-[85vh] flex flex-col animate-fade-in animate-slide-up">
            <button onClick={() => setBatchRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <span>💸 Hoàn tiền hàng loạt ({selectedOrderIds.length} đơn)</span>
            </h2>
            <p className="text-slate-400 mb-4">Nhập thông tin sự cố và xem trước bảng tính tiền hoàn trả trước khi lưu.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Lý do lỗi / hoàn tiền *</label>
                <input
                  type="text"
                  required
                  value={batchRefundReason}
                  onChange={e => setBatchRefundReason(e.target.value)}
                  placeholder="Sai mật khẩu, tài khoản lỗi..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase tracking-wider">Ngày xảy ra sự cố *</label>
                <input
                  type="date"
                  required
                  value={batchRefundErrorDate}
                  onChange={e => setBatchRefundErrorDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto rounded-xl border border-white/5 bg-[#131722]/30 mb-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Khách hàng</th>
                    <th className="px-4 py-3 text-right">Giá bán</th>
                    <th className="px-4 py-3 text-right">Giá vốn</th>
                    <th className="px-4 py-3 text-right text-rose-400 font-bold">Hoàn khách</th>
                    <th className="px-4 py-3 text-right text-emerald-400 font-bold">Nguồn hoàn</th>
                    <th className="px-4 py-3 text-right">Lãi sau hoàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {batchRefundPreviews.list.map(p => (
                    <tr key={p.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-4 py-2.5 font-bold text-indigo-400">{p.orderCode}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-medium">{p.customerName}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">{formatCurrency(p.salePrice)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">{formatCurrency(p.costPrice)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-400">{formatCurrency(p.clientRefund)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-400">+{formatCurrency(p.sourceRefund)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-bold ${p.profitAfter >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(p.profitAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aggregated totals */}
            <div className="grid grid-cols-3 gap-3.5 mb-4 p-4 rounded-xl bg-white/2 border border-white/5 text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng hoàn khách</span>
                <span className="text-sm font-black text-rose-400 font-mono mt-1 block">{formatCurrency(batchRefundPreviews.totalClientRefund)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tổng nguồn hoàn</span>
                <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">+{formatCurrency(batchRefundPreviews.totalSourceRefund)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Lợi nhuận sau hoàn</span>
                <span className={`text-sm font-black font-mono mt-1 block ${batchRefundPreviews.totalProfitAfter >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
                  {formatCurrency(batchRefundPreviews.totalProfitAfter)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setBatchRefundModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleBatchAction('BATCH_REFUND', {
                  errorDate: batchRefundErrorDate,
                  reason: batchRefundReason,
                })}
                disabled={batchLoading || !batchRefundReason}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-all cursor-pointer shadow-lg shadow-rose-600/10"
              >
                {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Xác nhận hoàn tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 6: BATCH CHANGE SOURCE --- */}
      {batchSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setBatchSourceModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Đổi nguồn hàng loạt ({selectedOrderIds.length} đơn)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Chọn nguồn hàng mới *</label>
                <select
                  value={batchSourceId}
                  onChange={(e) => setBatchSourceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                >
                  <option value="">-- Chọn nguồn hàng --</option>
                  {supplierSources.map(src => (
                    <option key={src.id} value={src.id}>{src.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchSourceModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button 
                  type="button" 
                  onClick={() => handleBatchAction('CHANGE_SOURCE', { supplierSourceId: batchSourceId })}
                  disabled={batchLoading || !batchSourceId} 
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer disabled:opacity-50"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận đổi nguồn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 7: BATCH RENEW --- */}
      {batchRenewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
            <button onClick={() => setBatchRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Gia hạn hàng loạt ({selectedOrderIds.length} đơn)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Số ngày gia hạn thêm *</label>
                <select
                  value={batchRenewDays}
                  onChange={(e) => setBatchRenewDays(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-[#131722] border border-white/10 text-white focus:outline-none"
                >
                  <option value="30">30 ngày</option>
                  <option value="60">60 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">365 ngày</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá bán cộng thêm (₫/đơn)</label>
                  <input
                    type="number"
                    value={batchRenewSalePrice}
                    onChange={(e) => setBatchRenewSalePrice(e.target.value)}
                    placeholder="để trống = 0"
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá vốn cộng thêm (₫/đơn)</label>
                  <input
                    type="number"
                    value={batchRenewCostPrice}
                    onChange={(e) => setBatchRenewCostPrice(e.target.value)}
                    placeholder="để trống = 0"
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lưu ý gia hạn (Không bắt buộc)</label>
                <input type="text" value={batchRenewNote} onChange={(e) => setBatchRenewNote(e.target.value)} placeholder="Ghi chú gia hạn..." className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchRenewModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button 
                  type="button" 
                  onClick={() => handleBatchAction('RENEW', { 
                    daysToExtend: batchRenewDays, 
                    additionalSalePrice: batchRenewSalePrice, 
                    additionalCostPrice: batchRenewCostPrice, 
                    note: batchRenewNote 
                  })}
                  disabled={batchLoading} 
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL BATCH PAYMENT --- */}
      {batchPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs animate-fade-in">
            <button onClick={() => setBatchPaymentModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Thanh toán hàng loạt ({selectedOrderIds.length} đơn)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Phương thức thanh toán *</label>
                <select
                  value={batchPaymentMethod}
                  onChange={(e) => setBatchPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                >
                  <option value="BANK_TRANSFER">🏦 Chuyển khoản</option>
                  <option value="WALLET">💰 Ví tiền</option>
                  <option value="MOMO">📱 Momo</option>
                  <option value="CASH">💵 Tiền mặt</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ghi chú thanh toán</label>
                <input 
                  type="text" 
                  value={batchPaymentNote} 
                  onChange={(e) => setBatchPaymentNote(e.target.value)} 
                  placeholder="Ghi chú thanh toán hàng loạt..." 
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none" 
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchPaymentModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button 
                  type="button" 
                  onClick={() => handleBatchAction('PAYMENT_BATCH', { method: batchPaymentMethod, note: batchPaymentNote })}
                  disabled={batchLoading} 
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận thanh toán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL BATCH CONFIRM SOURCE REFUND --- */}
      {batchConfirmRefundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs animate-fade-in">
            <button onClick={() => setBatchConfirmRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Cập nhật trạng thái hoàn tiền hàng loạt ({selectedOrderIds.length} đơn)</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Trạng thái hoàn tiền của nguồn hàng *</label>
                <select
                  value={batchSourceStatus}
                  onChange={(e) => setBatchSourceStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                >
                  <option value="REFUNDED">🟢 Đã hoàn tiền</option>
                  <option value="REJECTED">🔴 Từ chối hoàn tiền</option>
                  <option value="PENDING">🟡 Đang xử lý</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Số tiền nguồn hoàn (để trống = dùng số dự kiến)</label>
                <input 
                  type="number" 
                  value={batchSourceRefundActual} 
                  onChange={(e) => setBatchSourceRefundActual(e.target.value)} 
                  placeholder="Dự kiến hoàn" 
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none" 
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setBatchConfirmRefundModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button 
                  type="button" 
                  onClick={() => handleBatchAction('CONFIRM_SOURCE_REFUND', { 
                    sourceRefundActual: batchSourceRefundActual ? parseFloat(batchSourceRefundActual) : undefined, 
                    sourceStatus: batchSourceStatus 
                  })}
                  disabled={batchLoading} 
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer"
                >
                  {batchLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- BATCH RESULTS REPORT DIALOG --- */}
      {batchResultsReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs max-h-[85vh] flex flex-col animate-fade-in">
            <button 
              onClick={() => setBatchResultsReport(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-base font-bold text-white mb-4">📊 Kết quả xử lý hàng loạt</h2>
            
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
              <div className="p-3.5 rounded-xl bg-white/3 border border-white/5">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Tổng số đơn</span>
                <span className="text-base font-bold text-white mt-1 block">
                  {((batchResultsReport as any).total ?? 0) || (((batchResultsReport as any).successCount ?? 0) + ((batchResultsReport as any).errorCount ?? 0))}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Thành công</span>
                <span className="text-base font-bold text-emerald-400 mt-1 block">
                  {((batchResultsReport as any).success ?? 0) || ((batchResultsReport as any).successCount ?? 0)}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/10">
                <span className="text-[10px] text-rose-400 uppercase font-bold block">Thất bại</span>
                <span className="text-base font-bold text-rose-400 mt-1 block">
                  {((batchResultsReport as any).failed ?? 0) || ((batchResultsReport as any).errorCount ?? 0)}
                </span>
              </div>
            </div>

            {batchResultsReport.errors && batchResultsReport.errors.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2 mt-2 pr-1">
                <p className="font-bold text-rose-400 mb-2">Chi tiết lỗi các đơn hàng thất bại:</p>
                {batchResultsReport.errors.map((err: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-slate-300">
                    <div className="flex justify-between font-bold">
                      <span className="text-indigo-400">{err.orderCode}</span>
                      <span className="text-white">{err.customerName}</span>
                    </div>
                    <p className="text-[10px] text-rose-400 mt-1">Lỗi: {err.reason}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                🎉 Tất cả đơn hàng đã được xử lý thành công không xảy ra lỗi nào!
              </div>
            )}

            <button 
              onClick={() => setBatchResultsReport(null)}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 1: CREATE ORDER --- */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in my-8 max-h-[90vh] flex flex-col text-white">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-400" />
              Tạo đơn hàng thủ công mới
            </h2>

            <form onSubmit={handleCreateOrderSubmit} className="space-y-6 flex-1 overflow-y-auto pr-1">
              {/* Customer selection */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px]">1</span>
                  Thông tin khách hàng
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Chọn Khách hàng</label>
                    <select
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="new">+ Khách hàng mới (Nhập thông tin bên dưới)</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedCustomerOverdueDebt && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 animate-pulse">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <strong className="block font-bold text-sm text-white mb-0.5">⚠️ CẢNH BÁO: Khách hàng đang nợ quá hạn!</strong>
                      <span>Khách hàng này đang nợ quá hạn <strong>{selectedCustomerOverdueDebt.count}</strong> đơn hàng. Tổng số tiền nợ quá hạn: <strong className="text-rose-300 underline">{formatCurrency(selectedCustomerOverdueDebt.amount)}</strong>.</span>
                    </div>
                  </div>
                )}

                {formCustomerId === 'new' && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-lg bg-white/2 border border-white/5 text-xs">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Tên khách hàng *</label>
                      <input
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="0912345678"
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Facebook</label>
                      <input
                        type="text"
                        value={newCustomerFacebook}
                        onChange={(e) => setNewCustomerFacebook(e.target.value)}
                        placeholder="fb.com/username"
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Telegram</label>
                      <input
                        type="text"
                        value={newCustomerTelegram}
                        onChange={(e) => setNewCustomerTelegram(e.target.value)}
                        placeholder="@username"
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Zalo SĐT / Username</label>
                      <input
                        type="text"
                        value={newCustomerZalo}
                        onChange={(e) => setNewCustomerZalo(e.target.value)}
                        placeholder="0912345678"
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Ghi chú KH</label>
                      <input
                        type="text"
                        value={newCustomerNote}
                        onChange={(e) => setNewCustomerNote(e.target.value)}
                        placeholder="Ghi chú sở thích, nhu cầu..."
                        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Service & package */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px]">2</span>
                  Dịch vụ & Gói thời hạn
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Chọn dịch vụ *</label>
                    <select
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Tên gói dịch vụ *</label>
                    <input
                      type="text"
                      value={formPackageName}
                      onChange={(e) => setFormPackageName(e.target.value)}
                      placeholder="Ví dụ: Gói 30 ngày, Gói 1 năm"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Thời hạn (Số ngày) *</label>
                    <select
                      value={formDurationDays || '30'}
                      onChange={(e) => {
                        setFormDurationDays(e.target.value);
                        setFormPackageName(`Gói ${e.target.value} ngày`);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="30">30 ngày</option>
                      <option value="60">60 ngày</option>
                      <option value="90">90 ngày</option>
                      <option value="180">180 ngày</option>
                      <option value="365">365 ngày</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Credentials */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px]">3</span>
                  Tài khoản đăng nhập (Bàn giao cho khách)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Email tài khoản</label>
                    <input
                      type="text"
                      value={formAccountEmail}
                      onChange={(e) => setFormAccountEmail(e.target.value)}
                      placeholder="user@gmail.com"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Mật khẩu</label>
                    <input
                      type="text"
                      value={formAccountPassword}
                      onChange={(e) => setFormAccountPassword(e.target.value)}
                      placeholder="Nhập password"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Mã khôi phục (2FA / Backup link)</label>
                    <input
                      type="text"
                      value={formRecoveryCode}
                      onChange={(e) => setFormRecoveryCode(e.target.value)}
                      placeholder="Mã khôi phục..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Đường dẫn đăng nhập</label>
                    <input
                      type="text"
                      value={formLoginLink}
                      onChange={(e) => setFormLoginLink(e.target.value)}
                      placeholder="https://canva.com/login"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Hướng dẫn tài khoản (Hiển thị cho admin xem)</label>
                    <input
                      type="text"
                      value={formAccountNote}
                      onChange={(e) => setFormAccountNote(e.target.value)}
                      placeholder="Ví dụ: Đăng nhập bằng Gmail, không đổi pass..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Source & finance */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px]">4</span>
                  Nguồn nhập & Tài chính
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Chọn nguồn hàng</label>
                    <select
                      value={formSupplierSourceId}
                      onChange={(e) => setFormSupplierSourceId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Không liên kết nguồn --</option>
                      {supplierSources.map(src => (
                        <option key={src.id} value={src.id}>{src.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Giá bán (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={formSalePrice}
                      onChange={(e) => setFormSalePrice(e.target.value)}
                      placeholder="Nhập giá bán (để trống là 0)"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase flex items-center gap-1">
                      <Plug className="w-3.5 h-3.5 text-indigo-400" />
                      Giá vốn (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={formCostPrice}
                      onChange={(e) => setFormCostPrice(e.target.value)}
                      placeholder="Nhập giá vốn (để trống là 0)"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Thanh toán</label>
                    <select
                      value={formPaymentStatus}
                      onChange={(e) => setFormPaymentStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="PAID">🟢 Đã thanh toán</option>
                      <option value="UNPAID">🟡 Chưa thanh toán</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15 flex justify-between items-center text-xs font-medium text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Lợi nhuận dự tính = Giá bán - Giá vốn
                  </span>
                  <span className="text-white text-sm">
                    Lợi nhuận: <strong className={formProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(formProfit)}</strong>
                  </span>
                </div>
              </div>

              {/* Time & status */}
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px]">5</span>
                  Thời hạn hoạt động & Vận hành
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ngày hết hạn (Tự tính)</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Trạng thái đơn hàng</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="ACTIVE">🟢 Đang sử dụng</option>
                      <option value="EXPIRING_SOON">🟡 Sắp hết hạn</option>
                      <option value="WARRANTY">🔵 Đang bảo hành</option>
                      <option value="PENDING_REFUND">🟠 Chờ hoàn tiền</option>
                      <option value="REFUNDED">⚫ Đã hoàn tiền</option>
                      <option value="EXPIRED">🔴 Hết hạn</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ghi chú đơn hàng (Ví dụ: thông tin giao dịch, lưu ý đặc biệt)</label>
                    <textarea
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      placeholder="Ghi chú đơn hàng..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Tạo đơn hàng & Lưu
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: EDIT ORDER --- */}
      {editModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in my-8 max-h-[90vh] flex flex-col text-white">
            <button
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-bold text-white mb-4">Chỉnh sửa đơn hàng {selectedOrder.orderCode}</h2>

            <form onSubmit={handleEditOrderSubmit} className="space-y-6 flex-1 overflow-y-auto pr-1">
              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Thông tin dịch vụ & gói</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Dịch vụ *</label>
                    <select
                      value={editServiceId}
                      onChange={(e) => setEditServiceId(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Tên gói *</label>
                    <input
                      type="text"
                      value={editPackageName}
                      onChange={(e) => setEditPackageName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Thời hạn (ngày) *</label>
                    <select
                      value={editDurationDays || '30'}
                      onChange={(e) => {
                        setEditDurationDays(e.target.value);
                        setEditPackageName(`Gói ${e.target.value} ngày`);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="30">30 ngày</option>
                      <option value="60">60 ngày</option>
                      <option value="90">90 ngày</option>
                      <option value="180">180 ngày</option>
                      <option value="365">365 ngày</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Thông tin tài khoản</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Email tài khoản</label>
                    <input type="text" value={editAccountEmail} onChange={(e) => setEditAccountEmail(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Mật khẩu</label>
                    <input type="text" value={editAccountPassword} onChange={(e) => setEditAccountPassword(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Mã khôi phục / 2FA</label>
                    <input type="text" value={editRecoveryCode} onChange={(e) => setEditRecoveryCode(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Link đăng nhập</label>
                    <input type="text" value={editLoginLink} onChange={(e) => setEditLoginLink(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ghi chú hướng dẫn sử dụng tài khoản</label>
                    <input type="text" value={editAccountNote} onChange={(e) => setEditAccountNote(e.target.value)} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tài chính & nguồn hàng</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Nguồn hàng sỉ</label>
                    <select
                      value={editSupplierSourceId}
                      onChange={(e) => setEditSupplierSourceId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none"
                    >
                      <option value="">-- Không liên kết nguồn --</option>
                      {supplierSources.map(src => (
                        <option key={src.id} value={src.id}>{src.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Giá bán (₫)</label>
                    <input type="number" value={editSalePrice} onChange={(e) => setEditSalePrice(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Giá vốn (₫)</label>
                    <input type="number" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} disabled={!isAdmin} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed" />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/15 flex justify-between items-center text-xs">
                  <span>Lợi nhuận dự tính = Giá bán - Giá vốn</span>
                  <span className="text-white">Lợi nhuận: <strong className={editProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatCurrency(editProfit)}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Thời gian & Trạng thái</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ngày bắt đầu</label>
                    <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ngày hết hạn (Tự tính)</label>
                    <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} required className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Trạng thái đơn</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} required className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none">
                      <option value="ACTIVE">🟢 Đang hoạt động</option>
                      <option value="EXPIRING_SOON">🟡 Sắp hết hạn</option>
                      <option value="EXPIRED">🔴 Đã hết hạn</option>
                      <option value="WARRANTY">🔵 Chờ nguồn xử lý</option>
                      <option value="PENDING_REFUND">🟠 Chờ hoàn tiền</option>
                      {isAdmin && <option value="REFUNDED">⚫ Đã hoàn tiền</option>}
                      <option value="WARRANTY_REJECTED">❌ Từ chối bảo hành</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ghi chú nội bộ đơn hàng</label>
                    <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:outline-none resize-none" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-white/5 flex-shrink-0">
                <button type="button" onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 cursor-pointer">Hủy</button>
                <button type="submit" disabled={modalLoading} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RENEW ORDER --- */}
      {renewModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white text-xs">
            <button onClick={() => setRenewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Gia hạn đơn hàng {selectedOrder.orderCode}</h2>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Số ngày gia hạn thêm *</label>
                <select
                  value={renewDays || '30'}
                  onChange={(e) => setRenewDays(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-[#131722] border border-white/10 text-white focus:outline-none"
                >
                  <option value="30">30 ngày</option>
                  <option value="60">60 ngày</option>
                  <option value="90">90 ngày</option>
                  <option value="180">180 ngày</option>
                  <option value="365">365 ngày</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Doanh thu tăng thêm (₫)</label>
                  <input
                    type="number"
                    value={renewSalePrice}
                    onChange={(e) => setRenewSalePrice(e.target.value)}
                    placeholder="để trống = 0"
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Giá vốn tăng thêm (₫)</label>
                  <input
                    type="number"
                    value={renewCostPrice}
                    onChange={(e) => setRenewCostPrice(e.target.value)}
                    placeholder="để trống = 0"
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lưu ý gia hạn (Không bắt buộc)</label>
                <input type="text" value={renewNote} onChange={(e) => setRenewNote(e.target.value)} placeholder="Ghi chú gia hạn..." className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none" />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRenewModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={modalLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer">
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận gia hạn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: WARRANTY (BÁO LỖI) --- */}
      {warrantyModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white text-xs">
            <button onClick={() => setWarrantyModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            <h2 className="text-base font-bold text-white mb-4">Báo lỗi tài khoản đơn {selectedOrder.orderCode}</h2>

            <form onSubmit={handleWarrantySubmit} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ngày xảy ra lỗi *</label>
                <input
                  type="date"
                  value={warrantyErrorDate}
                  onChange={(e) => setWarrantyErrorDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lý do báo lỗi (Không bắt buộc)</label>
                <input
                  type="text"
                  value={warrantyReason}
                  onChange={(e) => setWarrantyReason(e.target.value)}
                  placeholder="Ví dụ: Lỗi mật khẩu, mất premium..."
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Ghi chú chi tiết thêm (Không bắt buộc)</label>
                <textarea
                  value={warrantyNote}
                  onChange={(e) => setWarrantyNote(e.target.value)}
                  placeholder="Mô tả chi tiết thêm nếu cần..."
                  rows={3}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setWarrantyModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={modalLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer">
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận báo lỗi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: REFUND (HOÀN TIỀN) --- */}
      {refundModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl animate-fade-in text-white text-xs">
            <button onClick={() => setRefundModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            
            <div className="text-center space-y-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto text-rose-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Xử lý Hoàn tiền Đơn hàng</h2>
                <p className="text-xs text-slate-400 mt-1">Hệ thống tự động tính toán số tiền hoàn pro-rata theo ngày lỗi thực tế.</p>
              </div>
            </div>

            <form onSubmit={handleRefundSubmit} className="space-y-4">
              {/* Structured Refund Display */}
              <div className="space-y-3.5">
                {/* THÔNG TIN ĐƠN */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">1. Thông tin đơn hàng</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                    <div><span className="text-slate-500">Mã đơn:</span> <strong className="text-white">{selectedOrder.orderCode}</strong></div>
                    <div><span className="text-slate-500">Khách hàng:</span> <strong className="text-white">{selectedOrder.customer.name}</strong></div>
                    <div><span className="text-slate-500">Dịch vụ:</span> <strong className="text-white">{selectedOrder.service.name}</strong></div>
                    <div><span className="text-slate-500">Nguồn hàng:</span> <strong className="text-white">{selectedOrder.supplierSourceName || '—'}</strong></div>
                  </div>
                </div>

                {/* THÔNG TIN THỜI GIAN */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">2. Thông tin thời gian</h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] leading-relaxed">
                    <div><span className="text-slate-500">Ngày mua:</span> <strong className="text-white">{new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày bắt đầu:</span> <strong className="text-white">{new Date(selectedOrder.startDate).toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày hoàn:</span> <strong className="text-white">{new Date().toLocaleDateString('vi-VN')}</strong></div>
                    <div><span className="text-slate-500">Ngày hết hạn:</span> <strong className="text-white">{new Date(selectedOrder.endDate).toLocaleDateString('vi-VN')}</strong></div>
                  </div>
                </div>

                {/* THÔNG TIN TÀI CHÍNH */}
                <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-1.5">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">3. Thông tin tài chính ban đầu</h4>
                  <div className="grid grid-cols-3 gap-2 text-[11px] leading-relaxed font-mono">
                    <div><span className="text-slate-500 block">Giá bán:</span> <strong className="text-emerald-400">{formatCurrency(selectedOrder.salePrice)}</strong></div>
                    <div><span className="text-slate-500 block">Giá vốn:</span> <strong className="text-slate-400">{formatCurrency(selectedOrder.costPrice)}</strong></div>
                    <div><span className="text-slate-500 block">Lợi nhuận đầu:</span> <strong className="text-indigo-300">{formatCurrency(selectedOrder.salePrice - selectedOrder.costPrice)}</strong></div>
                  </div>
                </div>

                {/* TÍNH TOÁN */}
                <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-2 text-[11px]">
                  <h4 className="font-bold text-indigo-400 text-[10px] uppercase tracking-wider">4. Tính toán hoàn tiền pro-rata theo ngày lỗi</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs pb-2 border-b border-white/5 font-semibold">
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Số ngày sử dụng gói:</span>
                      <span className="text-white font-semibold">{selectedOrder.durationDays || 30} ngày</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Thời gian đã dùng:</span>
                      <span className="text-white font-semibold">{refundCalculation.daysUsed} ngày</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-slate-400">Thời gian còn lại:</span>
                      <span className="text-indigo-300 font-bold">{refundCalculation.daysRemaining} ngày</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
                    <div className="space-y-1 p-2 rounded bg-white/2 border border-white/5">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider block">👤 HOÀN KHÁCH HÀNG</span>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Giá/ngày:</span>
                        <span>{formatCurrency(refundCalculation.costPerDay)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-emerald-400 mt-1 border-t border-white/5 pt-1">
                        <span>Dự kiến hoàn:</span>
                        <span>{formatCurrency(refundCalculation.computedAmount)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 p-2 rounded bg-white/2 border border-white/5">
                      <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block">🏢 NGUỒN PHẢI HOÀN</span>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Vốn/ngày:</span>
                        <span>{formatCurrency(refundCalculation.supplierCostPerDay)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold text-purple-400 mt-1 border-t border-white/5 pt-1">
                        <span>Dự kiến hoàn:</span>
                        <span>{formatCurrency(refundCalculation.computedSourceRefundExpected)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Net Profit Display */}
                  <div className="mt-3 p-2.5 rounded-lg bg-black/30 border border-white/5 flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-400 font-sans">Lợi nhuận ròng sau hoàn:</span>
                    <div>
                      <strong className={`font-bold ${dynamicNetProfit > 0 ? 'text-emerald-400' : dynamicNetProfit < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {formatCurrency(dynamicNetProfit)}
                      </strong>
                      <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold ${
                        dynamicNetProfit > 0 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : dynamicNetProfit < 0 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                      }`}>
                        {dynamicNetProfit > 0 ? '🟢 LÃI' : dynamicNetProfit < 0 ? '🔴 LỖ' : '🟡 HOÀ VỐN'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Targets and Overrides inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Trạng thái đích sau hoàn *</label>
                  <select
                    value={refundTargetStatus}
                    onChange={(e) => setRefundTargetStatus(e.target.value as 'PENDING_REFUND' | 'REFUNDED')}
                    required
                    className="w-full px-3 py-2 rounded bg-[#1a1f2e] border border-white/10 text-white focus:outline-none"
                  >
                    <option value="REFUNDED">⚫ Đã hoàn tiền (Hoàn tất)</option>
                    <option value="PENDING_REFUND">🟠 Chờ hoàn tiền (Chờ chuyển khoản)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Ngày lỗi (pro-rata)*</label>
                  <input
                    type="date"
                    value={refundErrorDate}
                    onChange={(e) => setRefundErrorDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="overrideSourceRefund"
                  checked={overrideSourceRefund}
                  onChange={(e) => {
                    setOverrideSourceRefund(e.target.checked);
                    if (!e.target.checked) {
                      setRefundOverrideSourceRefundActual('');
                    }
                  }}
                  className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 focus:ring-offset-[#131722] cursor-pointer"
                />
                <label htmlFor="overrideSourceRefund" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                  Nguồn hoàn khác dự kiến
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Số tiền hoàn khách (để trống nếu tự tính)</label>
                  <input
                    type="number"
                    value={refundOverrideAmount}
                    onChange={(e) => setRefundOverrideAmount(e.target.value)}
                    placeholder={`Ví dụ: ${refundCalculation.computedAmount}`}
                    className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Nguồn hoàn thực tế</label>
                  <input
                    type="number"
                    disabled={!overrideSourceRefund}
                    value={overrideSourceRefund ? refundOverrideSourceRefundActual : ''}
                    onChange={(e) => setRefundOverrideSourceRefundActual(e.target.value)}
                    placeholder={refundCalculation.computedSourceRefundExpected.toString()}
                    className={`w-full px-3 py-2 rounded bg-white/5 border text-white focus:outline-none font-mono transition-all ${
                      !overrideSourceRefund ? 'opacity-40 border-white/5 bg-slate-900/10 cursor-not-allowed' : 'border-white/10 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Lý do hoàn tiền *</label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Nhập lý do hoàn tiền (bắt buộc)..."
                  required
                  rows={2}
                  className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-[10px] text-yellow-400 leading-relaxed">
                ℹ️ Lưu ý: Bạn cần chuyển khoản giao dịch hoàn tiền thực tế cho khách qua ví/ngân hàng, hệ thống chỉ lưu nhật ký và hạch toán lợi nhuận.
              </div>

              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button type="button" onClick={() => setRefundModalOpen(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5">Hủy</button>
                <button type="submit" disabled={modalLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer">
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Xác nhận hoàn tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statusPopupOpen && statusPopupOrder && (
        <StatusChangePopup
          isOpen={statusPopupOpen}
          onClose={() => {
            setStatusPopupOpen(false);
            setStatusPopupOrder(null);
          }}
          title={`Đổi trạng thái đơn ${statusPopupOrder.orderCode}`}
          currentStatus={statusPopupOrder.status}
          allowedStatuses={[
            { value: 'ACTIVE', label: '🟢 Đang sử dụng' },
            { value: 'EXPIRING_SOON', label: '🟡 Sắp hết hạn' },
            { value: 'EXPIRED', label: '🔴 Đã hết hạn' },
            { value: 'WARRANTY', label: '🔵 Đang bảo hành' },
            { value: 'WARRANTY_PENDING_SOURCE', label: '🟣 Chờ hoàn nguồn' },
            { value: 'WARRANTY_PENDING_REFUND', label: '🟠 Chờ hoàn tiền khách' },
            ...(isAdmin ? [
              { value: 'WARRANTY_DONE', label: '✅ Đã hoàn tất bảo hành' },
              { value: 'REFUNDED', label: '⚫ Đã hoàn tiền' },
            ] : []),
            { value: 'WARRANTY_REJECTED', label: '⛔ Từ chối bảo hành' },
          ]}
          onSubmit={handleStatusChangeSubmit}
        />
      )}
    </div>
  );
}
