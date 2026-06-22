export const APP_NAME = 'BanHangMMO';
export const APP_DESCRIPTION = 'Hệ thống quản lý và bán tài khoản dịch vụ số chuyên nghiệp';
export const APP_TAGLINE = 'Quản lý tài khoản số • Dễ dùng • Dễ quản lý';

export const ROLES = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  AGENT: 'AGENT',
  CTV: 'CTV',
  CUSTOMER: 'CUSTOMER',
} as const;

export const ACCOUNT_TIERS = {
  RETAIL: 'RETAIL',
  CTV: 'CTV',
  AGENT_2: 'AGENT_2',
  AGENT_1: 'AGENT_1',
} as const;

// #35 - Order statuses with new warranty flow
export const ORDER_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  WARRANTY: 'WARRANTY', // Khách báo lỗi
  WARRANTY_PENDING_SOURCE: 'WARRANTY_PENDING_SOURCE', // Chờ nguồn hoàn tiền
  WARRANTY_PENDING_REFUND: 'WARRANTY_PENDING_REFUND', // Chờ hoàn khách (nguồn đã đồng ý)
  WARRANTY_DONE: 'WARRANTY_DONE', // Hoàn tất bảo hành
  WARRANTY_REJECTED: 'WARRANTY_REJECTED', // Nguồn từ chối bảo hành
  REFUNDED: 'REFUNDED', // Legacy - đã hoàn tiền
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '🟢 Đang sử dụng',
  EXPIRING_SOON: '🟡 Sắp hết hạn',
  EXPIRED: '🔴 Hết hạn',
  WARRANTY: '🔵 Khách báo lỗi',
  WARRANTY_PENDING_SOURCE: '🟣 Chờ nguồn hoàn',
  WARRANTY_PENDING_REFUND: '🟠 Chờ hoàn khách',
  WARRANTY_DONE: '✅ Hoàn tất BH',
  WARRANTY_REJECTED: '⛔ Từ chối BH',
  REFUNDED: '⚫ Đã hoàn tiền',
  PENDING_REFUND: '🟠 Chờ hoàn tiền', // legacy
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  EXPIRING_SOON: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  EXPIRED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  WARRANTY: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  WARRANTY_PENDING_SOURCE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  WARRANTY_PENDING_REFUND: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  WARRANTY_DONE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  WARRANTY_REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  REFUNDED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  PENDING_REFUND: 'bg-orange-500/10 text-orange-400 border-orange-500/20', // legacy
};

// #72 - Payment statuses (independent from order status)
export const PAYMENT_STATUSES = {
  UNPAID: 'UNPAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
} as const;

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: '🔴 Chưa thanh toán',
  PAID: '🟢 Đã thanh toán',
  OVERDUE: '🔥 Quá hạn',
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500/10 text-red-400 border-red-500/20',
  PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  OVERDUE: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

// #37 - Simplified source refund statuses
export const SOURCE_REFUND_STATUSES = {
  PENDING: 'PENDING',
  REFUNDED: 'REFUNDED',
  REJECTED: 'REJECTED',
} as const;

export const SOURCE_REFUND_LABELS: Record<string, string> = {
  PENDING: '⏳ Đang chờ nguồn',
  REFUNDED: '✅ Nguồn đã hoàn',
  REJECTED: '❌ Nguồn từ chối',
  // Legacy mappings
  NOT_REQUESTED: '⏳ Đang chờ nguồn',
  REQUESTED: '⏳ Đang chờ nguồn',
  APPROVED: '⏳ Đang chờ nguồn',
};

export const SOURCE_REFUND_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REFUNDED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  NOT_REQUESTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  REQUESTED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

// #41 - Customer tags (color badges)
export const CUSTOMER_TAGS = {
  NEW: 'NEW',
  REGULAR: 'REGULAR',
  VIP: 'VIP',
  INACTIVE_30: 'INACTIVE_30',
  INACTIVE_60: 'INACTIVE_60',
  INACTIVE_90: 'INACTIVE_90',
} as const;

export const CUSTOMER_TAG_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  NEW: { label: 'Mới', emoji: '🟢', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  REGULAR: { label: 'Quen', emoji: '🔵', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  VIP: { label: 'VIP', emoji: '🟣', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  INACTIVE_30: { label: '30N', emoji: '🟠', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  INACTIVE_60: { label: '60N', emoji: '🔴', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  INACTIVE_90: { label: '90N', emoji: '⚫', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

// #67 - Credit ratings
export const CREDIT_RATINGS = {
  A_PLUS: 'A_PLUS',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
} as const;

export const CREDIT_RATING_CONFIG: Record<string, { label: string; color: string }> = {
  A_PLUS: { label: 'A+', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  A: { label: 'A', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  B: { label: 'B', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  C: { label: 'C', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  D: { label: 'D', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export const PAYMENT_METHODS = {
  WALLET: 'WALLET',
  BANK_TRANSFER: 'BANK_TRANSFER',
  MOMO: 'MOMO',
  ZALOPAY: 'ZALOPAY',
  VIETQR: 'VIETQR',
  CASH: 'CASH',
} as const;

export const ORDER_SOURCES = {
  WEBSITE: 'WEBSITE',
  CTV: 'CTV',
  AGENT: 'AGENT',
  DIRECT: 'DIRECT',
  ZALO: 'ZALO',
  TELEGRAM: 'TELEGRAM',
} as const;

export const ACCOUNT_STATUSES = {
  READY: 'READY',
  IN_USE: 'IN_USE',
  MAINTENANCE: 'MAINTENANCE',
  LOCKED: 'LOCKED',
  EXPIRED: 'EXPIRED',
} as const;

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  LOCKED: 'LOCKED',
} as const;

export const WALLET_TXN_TYPES = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAW: 'WITHDRAW',
  PAYMENT: 'PAYMENT',
  REFUND: 'REFUND',
  COMMISSION: 'COMMISSION',
} as const;

export const WALLET_TXN_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export const TICKET_STATUSES = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export const COMMISSION_STATUSES = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export const NOTIFICATION_TYPES = {
  EXPIRY_30D: 'EXPIRY_30D',
  EXPIRY_7D: 'EXPIRY_7D',
  EXPIRY_3D: 'EXPIRY_3D',
  EXPIRY_1D: 'EXPIRY_1D',
  EXPIRED: 'EXPIRED',
  SYSTEM: 'SYSTEM',
} as const;

export const DURATION_DAYS_OPTIONS = [1, 3, 7, 15, 30, 90, 180, 365] as const;

// Default payment due days (#63)
export const DEFAULT_PAYMENT_DUE_DAYS = 3;

// Warranty statuses that indicate order is in warranty process
export const WARRANTY_STATUSES = [
  'WARRANTY',
  'WARRANTY_PENDING_SOURCE',
  'WARRANTY_PENDING_REFUND',
  'WARRANTY_DONE',
  'WARRANTY_REJECTED',
] as const;

// Bank info for manual transfer
export const BANK_INFO = {
  bankName: 'Vietcombank',
  accountNumber: '1234567890',
  accountHolder: 'CONG TY BAN HANG MMO',
  branch: 'Chi nhánh Hà Nội',
  transferNote: 'NAP [MÃ_USER]',
};

// Commission rates by tier (%)
export const COMMISSION_RATES = {
  CTV: 5,
  AGENT_2: 3,
  AGENT_1: 2,
} as const;
