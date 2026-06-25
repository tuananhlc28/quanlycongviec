// Utility functions
import { type ClassValue, clsx } from 'clsx';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  CUSTOMER_TAG_CONFIG,
  CREDIT_RATING_CONFIG,
  SOURCE_REFUND_LABELS,
  SOURCE_REFUND_COLORS,
} from './constants';

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function generateOrderCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'DH-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateTicketCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'HT-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateBatchCode(serviceSlug: string): string {
  const chars = '0123456789';
  let result = `LO-${serviceSlug.toUpperCase().slice(0, 4)}-`;
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateCustomerCode(): string {
  const chars = '0123456789';
  let result = 'KH-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function getPriceByTier(
  variant: {
    retailPrice: number;
    ctvPrice: number;
    agent2Price: number;
    agent1Price: number;
  },
  accountTier: string
): number {
  switch (accountTier) {
    case 'AGENT_1':
      return variant.agent1Price;
    case 'AGENT_2':
      return variant.agent2Price;
    case 'CTV':
      return variant.ctvPrice;
    default:
      return variant.retailPrice;
  }
}

// ==========================================
// Status Labels & Colors (using constants)
// ==========================================

export function getStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function getStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

export function getPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function getPaymentStatusColor(status: string): string {
  return PAYMENT_STATUS_COLORS[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

export function getSourceRefundLabel(status: string): string {
  return SOURCE_REFUND_LABELS[status] || status;
}

export function getSourceRefundColor(status: string): string {
  return SOURCE_REFUND_COLORS[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

export function getCustomerTagConfig(tag: string) {
  return CUSTOMER_TAG_CONFIG[tag] || CUSTOMER_TAG_CONFIG['NEW'];
}

export function getCreditRatingConfig(rating: string) {
  return CREDIT_RATING_CONFIG[rating] || CREDIT_RATING_CONFIG['B'];
}

// ==========================================
// Other label/color helpers (unchanged)
// ==========================================

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    STAFF: 'Nhân viên',
    AGENT: 'Đại lý',
    CTV: 'Cộng tác viên',
    CUSTOMER: 'Khách hàng',
  };
  return labels[role] || role;
}

export function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    RETAIL: 'Khách lẻ',
    CTV: 'CTV',
    AGENT_2: 'Đại lý cấp 2',
    AGENT_1: 'Đại lý cấp 1',
  };
  return labels[tier] || tier;
}

export function getAccountStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    READY: 'Sẵn sàng',
    IN_USE: 'Đang sử dụng',
    MAINTENANCE: 'Bảo trì',
    LOCKED: 'Đã khóa',
    EXPIRED: 'Hết hạn',
  };
  return labels[status] || status;
}

export function getAccountStatusColor(status: string): string {
  const colors: Record<string, string> = {
    READY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    IN_USE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    MAINTENANCE: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    LOCKED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    EXPIRED: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    WALLET: 'Ví tiền',
    BANK_TRANSFER: 'Chuyển khoản',
    MOMO: 'Momo',
    ZALOPAY: 'ZaloPay',
    VIETQR: 'VietQR',
    CASH: 'Tiền mặt',
  };
  return labels[method] || method;
}

export function getPaymentMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    WALLET: '💰',
    BANK_TRANSFER: '🏦',
    MOMO: '📱',
    ZALOPAY: '💳',
    VIETQR: '📷',
    CASH: '💵',
  };
  return icons[method] || '💳';
}

export function getOrderSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    WEBSITE: 'Website',
    CTV: 'CTV',
    AGENT: 'Đại lý',
    DIRECT: 'Trực tiếp',
    ZALO: 'Zalo',
    TELEGRAM: 'Telegram',
  };
  return labels[source] || source;
}

// ==========================================
// Subscription / Remaining helpers
// ==========================================

export function getSubscriptionRemainingDays(endDate: Date | string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getSubscriptionRemainingLabel(remainingDays: number): string {
  if (remainingDays <= 0) {
    return 'Hết hạn';
  }
  if (remainingDays === 1) {
    return 'Hết hạn hôm nay';
  }
  return `Còn ${remainingDays} ngày`;
}

export function getSubscriptionRemainingColorClass(remainingDays: number, status?: string): string {
  if (status === 'LOCKED') {
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  }
  if (remainingDays <= 0) {
    return 'text-red-400 bg-red-500/10 border-red-500/20';
  }
  if (remainingDays < 7) {
    return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  }
  if (remainingDays < 30) {
    return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  }
  return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
}

// ==========================================
// Financial calculations (#50, #52)
// ==========================================

/**
 * #50 - Calculate real profit after refunds
 * Lợi nhuận thực = Giá bán - Giá vốn - Tiền hoàn khách + Tiền nguồn hoàn
 */
export function calculateRealProfit(
  salePrice: number,
  costPrice: number,
  clientRefund: number,
  sourceRefund: number
): number {
  return salePrice - costPrice - clientRefund + sourceRefund;
}

/**
 * #52 - Auto-calculate refund amount based on days used
 */
export function calculateAutoRefund(
  salePrice: number,
  totalDays: number,
  daysUsed: number
): { refundAmount: number; daysRemaining: number; costPerDay: number } {
  if (totalDays <= 0) return { refundAmount: 0, daysRemaining: 0, costPerDay: 0 };
  const costPerDay = salePrice / totalDays;
  const daysRemaining = Math.max(0, totalDays - daysUsed);
  const refundAmount = Math.round(daysRemaining * costPerDay);
  return { refundAmount, daysRemaining, costPerDay };
}

export function calculateRefundAmount(totalAmount: number, totalDays: number, remainingDays: number): number {
  if (remainingDays <= 0 || totalDays <= 0) return 0;
  const days = Math.min(remainingDays, totalDays);
  const dailyPrice = totalAmount / totalDays;
  return Math.round(dailyPrice * days);
}

export function calculateDailyPrice(totalAmount: number, totalDays: number): number {
  if (totalDays <= 0) return 0;
  return Math.round(totalAmount / totalDays);
}

export function calculateUsedDays(startDate: Date | string): number {
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

// ==========================================
// #67 - Credit rating calculation
// ==========================================

export function calculateCreditRating(stats: {
  totalOrders: number;
  paidOnTimeCount: number;
  latePaymentCount: number;
  currentDebtCount: number;
  totalSpend: number;
  daysSinceCreated?: number;
  renewalsCount?: number;
  warrantyCount?: number;
  totalRefund?: number;
}): string {
  const { 
    totalOrders, 
    paidOnTimeCount, 
    latePaymentCount, 
    currentDebtCount, 
    totalSpend, 
    daysSinceCreated = 0, 
    renewalsCount = 0, 
    warrantyCount = 0, 
    totalRefund = 0 
  } = stats;
  
  if (totalOrders === 0) return 'NEW';

  const onTimeRate = paidOnTimeCount / totalOrders;
  const refundRate = totalSpend > 0 ? (totalRefund / totalSpend) : 0;

  // Formula matching crm.ts
  let score = 75; // base
  score += Math.min(15, totalSpend / 200000);
  score += onTimeRate * 15;
  score -= currentDebtCount * 5;
  score -= latePaymentCount * 2;
  score += Math.min(10, renewalsCount * 2.5);
  score -= Math.min(15, warrantyCount * 3);
  score -= Math.min(15, refundRate * 100);
  score += Math.min(10, daysSinceCreated / 30);

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

// ==========================================
// #41 - Customer tag calculation
// ==========================================

export function calculateCustomerTag(stats: {
  orderCount: number;
  daysSinceLastOrder: number | null;
  totalSpend?: number;
}): string {
  const { orderCount, daysSinceLastOrder, totalSpend = 0 } = stats;

  if (daysSinceLastOrder === null) return 'NEW';

  if (daysSinceLastOrder >= 90) return 'INACTIVE_90';
  if (daysSinceLastOrder >= 60) return 'INACTIVE_60';
  if (daysSinceLastOrder >= 30) return 'INACTIVE_30';
  if (totalSpend >= 5000000 || orderCount >= 5) return 'VIP';
  if (orderCount >= 2) return 'REGULAR';
  return 'NEW';
}

// ==========================================
// Warranty status helpers
// ==========================================

export function isWarrantyStatus(status: string): boolean {
  return [
    'WARRANTY',
    'WARRANTY_PENDING_SOURCE',
    'WARRANTY_PENDING_REFUND',
    'WARRANTY_DONE',
    'WARRANTY_REJECTED',
  ].includes(status);
}

export function isActiveOrder(status: string): boolean {
  return ['ACTIVE', 'EXPIRING_SOON'].includes(status);
}

// ==========================================
// Search & Export
// ==========================================

// Fuzzy search - tìm kiếm gần đúng (bỏ dấu tiếng Việt)
export function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function fuzzyMatch(text: string, query: string): boolean {
  const normalizedText = normalizeVietnamese(text);
  const normalizedQuery = normalizeVietnamese(query);
  return normalizedText.includes(normalizedQuery);
}

// CSV Export
export function exportToCSV(data: Record<string, unknown>[], filename: string, headers?: Record<string, string>): void {
  if (data.length === 0) return;

  const keys = Object.keys(headers || data[0]);
  const headerRow = keys.map(k => headers?.[k] || k).join(',');

  const rows = data.map(item =>
    keys.map(key => {
      const val = item[key];
      const str = val === null || val === undefined ? '' : String(val);
      // Escape commas and quotes
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(',')
  );

  const csvContent = '\uFEFF' + [headerRow, ...rows].join('\n'); // BOM for Vietnamese
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Percentage change calculation
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
