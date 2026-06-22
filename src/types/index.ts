export type Role = 'ADMIN' | 'STAFF' | 'AGENT' | 'CTV' | 'CUSTOMER';
export type AccountTier = 'RETAIL' | 'CTV' | 'AGENT_2' | 'AGENT_1';

// #35 - New order statuses with warranty flow
export type OrderStatus =
  | 'ACTIVE'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'WARRANTY'
  | 'WARRANTY_PENDING_SOURCE'
  | 'WARRANTY_PENDING_REFUND'
  | 'WARRANTY_DONE'
  | 'WARRANTY_REJECTED'
  | 'REFUNDED'
  | 'PENDING_REFUND'; // legacy

// #72 - Payment status (independent from order status)
export type PaymentStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

// #37 - Simplified source refund status
export type SourceRefundStatus = 'PENDING' | 'REFUNDED' | 'REJECTED';

// #41 - Customer tags
export type CustomerTag = 'NEW' | 'REGULAR' | 'VIP' | 'INACTIVE_30' | 'INACTIVE_60' | 'INACTIVE_90';

// #67 - Credit ratings
export type CreditRating = 'A_PLUS' | 'A' | 'B' | 'C' | 'D';

export type PaymentMethod = 'WALLET' | 'BANK_TRANSFER' | 'MOMO' | 'ZALOPAY' | 'VIETQR' | 'CASH';
export type OrderSource = 'WEBSITE' | 'CTV' | 'AGENT' | 'DIRECT' | 'ZALO' | 'TELEGRAM';
export type AccountStatus = 'READY' | 'IN_USE' | 'MAINTENANCE' | 'LOCKED' | 'EXPIRED';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'LOCKED';
export type WalletTxnType = 'DEPOSIT' | 'WITHDRAW' | 'PAYMENT' | 'REFUND' | 'COMMISSION';
export type WalletTxnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type CommissionStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type NotificationType = 'EXPIRY_30D' | 'EXPIRY_7D' | 'EXPIRY_3D' | 'EXPIRY_1D' | 'EXPIRED' | 'SYSTEM';

export interface DashboardStats {
  todayRevenue: number;
  todayProfit: number;
  todayOrdersCount: number;
  todayNewUsersCount: number;
  activeSubscriptions: number;
  readyAccounts: number;
  expiringSubscriptions: number;
  pendingTickets: number;
  // #60 - Real financial dashboard
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  totalClientRefund: number;
  totalSourceRefund: number;
  totalSourceDebt: number;
  realProfit: number;
  // #62 - Debt dashboard
  totalDebtAmount: number;
  unpaidOrdersCount: number;
  debtCustomersCount: number;
  overdueOrdersCount: number;
}

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  link?: string;
}
