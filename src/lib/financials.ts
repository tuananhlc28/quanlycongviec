/**
 * financials.ts — Service Layer tài chính tập trung
 *
 * ĐÂY LÀ NGUỒN DUY NHẤT cho mọi công thức tài chính.
 * Tất cả module (Dashboard, Bảo hành, Hoàn tiền, Công nợ) phải dùng file này.
 *
 * CÔNG THỨC CHUẨN:
 *   dailyRate         = salePrice / durationDays
 *   remainingValue    = dailyRate × daysRemaining
 *   expectedClientRefund  = remainingValue  (hoàn khách dự kiến = giá trị còn lại)
 *   expectedSourceRefund  = (costPrice / durationDays) × daysRemaining
 *   profitBeforeRefund    = salePrice - costPrice
 *   profitAfterRefund     = salePrice - costPrice - actualClientRefund + actualSourceRefund
 */

// ==========================================
// Types
// ==========================================

export interface OrderFinancials {
  // Input
  salePrice: number;
  costPrice: number;
  durationDays: number;
  daysUsed: number;
  daysRemaining: number;

  // Computed
  dailyRate: number;           // salePrice / durationDays
  costDailyRate: number;       // costPrice / durationDays
  remainingValue: number;      // dailyRate × daysRemaining

  // Refund — Expected
  expectedClientRefund: number;  // = remainingValue
  expectedSourceRefund: number;  // = costDailyRate × daysRemaining

  // Refund — Actual (from RefundHistory)
  actualClientRefund: number;
  actualSourceRefund: number;

  // Profit
  profitBeforeRefund: number;  // salePrice - costPrice
  profitAfterRefund: number;   // salePrice - costPrice - actualClientRefund + actualSourceRefund

  // Source status
  sourceDiff: number;          // actualSourceRefund - expectedSourceRefund (negative = source owes us)
}

export interface RefundHistoryInput {
  amount: number;           // tiền hoàn khách thực tế
  sourceRefundActual: number; // tiền nguồn hoàn thực tế
  sourceRefundExpected: number;
  sourceStatus: string;
  daysUsed: number;
  daysRemaining: number;
}

export interface DashboardAggregates {
  // Revenue & Cost
  totalRevenue: number;
  totalCost: number;
  totalProfitBeforeRefund: number;

  // Refunds
  totalClientRefundExpected: number;
  totalClientRefundActual: number;
  totalClientRefundPending: number; // chưa hoàn

  totalSourceRefundExpected: number;
  totalSourceRefundActual: number;
  totalSourceDebt: number; // nguồn còn nợ

  // Profit
  totalProfitAfterRefund: number;
  totalLossDueToSource: number; // lỗ do nguồn từ chối / chưa hoàn

  // Debts
  totalCustomerDebt: number;    // công nợ khách hàng

  // Net cash
  netCashRemaining: number; // profitAfterRefund - customerDebt + sourceDebt

  // Counts
  totalOrders: number;
  activeOrders: number;
  expiringSoonOrders: number;
  expiredOrders: number;
  warrantyOrders: number;
  refundedOrders: number;
}

export interface AgingBucket {
  notDue: number;       // chưa đến hạn hoặc không có due date
  overdue0to5: number;  // quá hạn 0-5 ngày
  overdue5to30: number; // quá hạn 5-30 ngày
  overdue30to90: number;// quá hạn 30-90 ngày
  overdueOver90: number;// quá hạn > 90 ngày
  totalDebt: number;
  avgAgingDays: number;
}

// ==========================================
// Core Financial Calculations
// ==========================================

/**
 * Tính đơn giá mỗi ngày từ giá bán
 */
export function calcDailyRate(salePrice: number, durationDays: number): number {
  if (durationDays <= 0) return 0;
  return salePrice / durationDays;
}

/**
 * Tính đơn giá vốn mỗi ngày
 */
export function calcCostDailyRate(costPrice: number, durationDays: number): number {
  if (durationDays <= 0) return 0;
  return costPrice / durationDays;
}

/**
 * Tính số ngày đã sử dụng từ ngày bắt đầu
 */
export function calcDaysUsed(startDate: Date | string, referenceDate?: Date): number {
  const start = new Date(startDate);
  const now = referenceDate || new Date();
  const diffMs = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Tính số ngày còn lại đến ngày hết hạn
 */
export function calcDaysRemaining(endDate: Date | string, referenceDate?: Date): number {
  const end = new Date(endDate);
  const now = referenceDate || new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Tính giá trị còn lại = đơn giá × số ngày còn lại
 */
export function calcRemainingValue(dailyRate: number, daysRemaining: number): number {
  return Math.round(dailyRate * daysRemaining);
}

/**
 * Tính tiền phải hoàn khách dự kiến = giá trị còn lại
 */
export function calcExpectedClientRefund(salePrice: number, durationDays: number, daysRemaining: number): number {
  const dailyRate = calcDailyRate(salePrice, durationDays);
  return Math.round(dailyRate * daysRemaining);
}

/**
 * Tính tiền nguồn phải hoàn dự kiến = (giá vốn / tổng ngày) × số ngày còn lại
 */
export function calcExpectedSourceRefund(costPrice: number, durationDays: number, daysRemaining: number): number {
  const costDailyRate = calcCostDailyRate(costPrice, durationDays);
  return Math.round(costDailyRate * daysRemaining);
}

/**
 * Lợi nhuận trước hoàn = giá bán - giá vốn
 */
export function calcProfitBeforeRefund(salePrice: number, costPrice: number): number {
  return salePrice - costPrice;
}

/**
 * Lợi nhuận sau hoàn = giá bán - giá vốn - hoàn khách thực tế + nguồn hoàn thực tế
 */
export function calcProfitAfterRefund(
  salePrice: number,
  costPrice: number,
  actualClientRefund: number,
  actualSourceRefund: number
): number {
  return salePrice - costPrice - actualClientRefund + actualSourceRefund;
}

/**
 * Tính toàn bộ thông số tài chính cho 1 đơn hàng
 * Đây là hàm trung tâm — mọi module phải dùng hàm này
 */
export function computeOrderFinancials(
  order: {
    salePrice: number;
    costPrice: number;
    durationDays: number;
    startDate: Date | string;
    endDate: Date | string;
  },
  refundHistories?: RefundHistoryInput[],
  referenceDate?: Date
): OrderFinancials {
  const now = referenceDate || new Date();

  const daysUsed = calcDaysUsed(order.startDate, now);
  const daysRemaining = calcDaysRemaining(order.endDate, now);
  const dailyRate = calcDailyRate(order.salePrice, order.durationDays);
  const costDailyRate = calcCostDailyRate(order.costPrice, order.durationDays);
  const remainingValue = calcRemainingValue(dailyRate, daysRemaining);

  const expectedClientRefund = calcExpectedClientRefund(order.salePrice, order.durationDays, daysRemaining);
  const expectedSourceRefund = calcExpectedSourceRefund(order.costPrice, order.durationDays, daysRemaining);

  // Sum actuals from refund histories
  const actualClientRefund = (refundHistories || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const actualSourceRefund = (refundHistories || []).reduce((sum, r) => sum + (r.sourceRefundActual || 0), 0);

  const profitBeforeRefund = calcProfitBeforeRefund(order.salePrice, order.costPrice);
  const profitAfterRefund = calcProfitAfterRefund(order.salePrice, order.costPrice, actualClientRefund, actualSourceRefund);

  const sourceDiff = actualSourceRefund - expectedSourceRefund;

  return {
    salePrice: order.salePrice,
    costPrice: order.costPrice,
    durationDays: order.durationDays,
    daysUsed,
    daysRemaining,
    dailyRate,
    costDailyRate,
    remainingValue,
    expectedClientRefund,
    expectedSourceRefund,
    actualClientRefund,
    actualSourceRefund,
    profitBeforeRefund,
    profitAfterRefund,
    sourceDiff,
  };
}

// ==========================================
// Aging (Tuổi nợ)
// ==========================================

/**
 * Phân loại tuổi nợ theo mốc thời gian
 */
export function computeAgingBuckets(
  debtOrders: Array<{
    remainingDebt: number;
    paymentDueDate: Date | string | null;
    paymentStatus: string;
  }>,
  referenceDate?: Date
): AgingBucket {
  const now = referenceDate || new Date();
  const result: AgingBucket = {
    notDue: 0,
    overdue0to5: 0,
    overdue5to30: 0,
    overdue30to90: 0,
    overdueOver90: 0,
    totalDebt: 0,
    avgAgingDays: 0,
  };

  let totalAgingDays = 0;
  let agingCount = 0;

  for (const order of debtOrders) {
    const debt = order.remainingDebt;
    result.totalDebt += debt;

    if (!order.paymentDueDate) {
      result.notDue += debt;
      continue;
    }

    const dueDate = new Date(order.paymentDueDate);
    if (now <= dueDate) {
      result.notDue += debt;
    } else {
      const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      totalAgingDays += overdueDays;
      agingCount++;

      if (overdueDays <= 5) {
        result.overdue0to5 += debt;
      } else if (overdueDays <= 30) {
        result.overdue5to30 += debt;
      } else if (overdueDays <= 90) {
        result.overdue30to90 += debt;
      } else {
        result.overdueOver90 += debt;
      }
    }
  }

  result.avgAgingDays = agingCount > 0 ? Math.round(totalAgingDays / agingCount) : 0;
  return result;
}

// ==========================================
// Source Debt Summary
// ==========================================

export interface SourceDebtSummary {
  sourceId: string;
  sourceName: string;
  totalOrders: number;
  requestedOrders: number;
  pendingOrders: number;
  refundedOrders: number;
  rejectedOrders: number;
  totalExpectedRefund: number;
  totalActualRefund: number;
  totalDebt: number;          // expectedRefund - actualRefund (còn nợ)
  totalRejectedRefund: number;  // tiền nguồn từ chối
  profitImpact: number;       // thiệt hại (tiền hoàn khách khi bị nguồn từ chối)
}

export function computeSourceDebtSummaries(
  refundHistories: Array<{
    amount: number;
    sourceStatus: string;
    sourceRefundExpected: number;
    sourceRefundActual: number;
    order: {
      supplierSourceId: string | null;
      supplierSourceName: string | null;
    };
  }>
): SourceDebtSummary[] {
  const map = new Map<string, SourceDebtSummary>();

  for (const r of refundHistories) {
    const sourceId = r.order.supplierSourceId || 'direct';
    const sourceName = r.order.supplierSourceName || 'Nguồn trực tiếp';

    if (!map.has(sourceId)) {
      map.set(sourceId, {
        sourceId,
        sourceName,
        totalOrders: 0,
        requestedOrders: 0,
        pendingOrders: 0,
        refundedOrders: 0,
        rejectedOrders: 0,
        totalExpectedRefund: 0,
        totalActualRefund: 0,
        totalDebt: 0,
        totalRejectedRefund: 0,
        profitImpact: 0,
      });
    }

    const s = map.get(sourceId)!;
    s.totalOrders++;
    s.totalExpectedRefund += r.sourceRefundExpected || 0;
    s.totalActualRefund += r.sourceRefundActual || 0;

    const status = r.sourceStatus;
    const isWaiting = ['PENDING', 'REQUESTED', 'APPROVED'].includes(status);
    if (isWaiting) {
      s.pendingOrders++;
      s.totalDebt += Math.max(0, (r.sourceRefundExpected || 0) - (r.sourceRefundActual || 0));
    } else if (status === 'REFUNDED') {
      s.refundedOrders++;
    } else if (status === 'REJECTED') {
      s.rejectedOrders++;
      s.totalRejectedRefund += r.sourceRefundExpected || 0;
      s.profitImpact += r.amount || 0; // lost money paid to client
    }

    if (['PENDING', 'REQUESTED', 'APPROVED', 'REFUNDED', 'REJECTED'].includes(status)) {
      s.requestedOrders++;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalDebt - a.totalDebt);
}

// ==========================================
// Dashboard Aggregates (optimized)
// ==========================================

export function computeRefundDashboard(
  refundHistories: Array<{
    amount: number;
    sourceRefundExpected: number;
    sourceRefundActual: number;
    sourceStatus: string;
    order: {
      salePrice: number;
      costPrice: number;
    };
  }>
) {
  let totalClientRefundActual = 0;
  let totalSourceRefundExpected = 0;
  let totalSourceRefundActual = 0;
  let totalProfitAfterRefund = 0;
  let totalSourceDebt = 0;

  for (const r of refundHistories) {
    totalClientRefundActual += r.amount || 0;
    totalSourceRefundExpected += r.sourceRefundExpected || 0;
    totalSourceRefundActual += r.sourceRefundActual || 0;

    const profit = calcProfitAfterRefund(
      r.order.salePrice,
      r.order.costPrice,
      r.amount || 0,
      r.sourceRefundActual || 0
    );
    totalProfitAfterRefund += profit;

    const isWaiting = ['PENDING', 'REQUESTED', 'APPROVED'].includes(r.sourceStatus);
    if (isWaiting) {
      totalSourceDebt += Math.max(0, (r.sourceRefundExpected || 0) - (r.sourceRefundActual || 0));
    }
  }

  const refundDiff = totalSourceRefundActual - totalSourceRefundExpected;

  return {
    totalClientRefundActual,
    totalSourceRefundExpected,
    totalSourceRefundActual,
    totalSourceDebt,
    refundDiff,
    totalProfitAfterRefund,
  };
}
