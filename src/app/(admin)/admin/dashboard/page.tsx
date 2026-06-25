import prisma from '@/lib/prisma';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  DollarSign,
  ShoppingCart,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  ArrowUpRight,
  User,
  Key,
  ShieldAlert,
  HelpCircle,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowDownRight,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import DashboardChart from './DashboardChart';
import TodayComparisonChart from './TodayComparisonChart';

export const revalidate = 0; // Disable cache for fresh admin data

async function getDashboardData() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Auto-update UNPAID orders past 1 day since startDate to OVERDUE status
  await prisma.order.updateMany({
    where: {
      paymentStatus: 'UNPAID',
      startDate: { lte: oneDayAgo },
    },
    data: {
      paymentStatus: 'OVERDUE',
    },
  });
  
  // Start & end of current month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Start & end of previous month
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Start & end of today
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // Start & end of yesterday
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
  const endOfYesterday = new Date(endOfToday.getTime() - 24 * 60 * 60 * 1000);

  // Threshold for overdue warranty (3 days ago)
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Fetch all orders with relations for aggregation
  const [allOrders, allRefunds, customersCountToday, customersCountMonth] = await Promise.all([
    prisma.order.findMany({
      include: {
        customer: true,
        service: true,
        supplierSource: true,
        refundHistories: true,
      },
    }),
    prisma.refundHistory.findMany({
      include: {
        order: true,
      }
    }),
    prisma.customer.count({
      where: { isDeleted: false, createdAt: { gte: startOfToday, lte: endOfToday } }
    }),
    prisma.customer.count({
      where: { isDeleted: false, createdAt: { gte: startOfMonth, lte: endOfMonth } }
    }),
  ]);

  // Today Operational Metrics
  let ordersTodayCount = 0;
  let revenueToday = 0;
  let costToday = 0;
  let refundToday = 0;
  let sourceRefundToday = 0;

  // Yesterday
  let ordersYesterdayCount = 0;
  let revenueYesterday = 0;
  let costYesterday = 0;
  let refundYesterday = 0;
  let sourceRefundYesterday = 0;

  // Lifetime totals
  let totalLifetimeRevenue = 0;
  let totalLifetimeCost = 0;
  let totalLifetimeClientRefund = 0;
  let totalLifetimeSourceRefund = 0;
  let totalLifetimeSourceExpected = 0;
  let totalLifetimeSourceRefundRejected = 0;

  // Undelivered orders (accountEmail is empty or null)
  let totalUndelivered = 0;

  // Monthly stats (current month M0 and previous month M1)
  let revenueM0 = 0, costM0 = 0, refundM0 = 0, sourceRefundM0 = 0, countM0 = 0;
  let revenueM1 = 0, costM1 = 0, refundM1 = 0, sourceRefundM1 = 0, countM1 = 0;

  // Overall warning counters
  let totalClientRefundPending = 0;
  let totalSourceDebtPending = 0;
  let warrantyOverdueCount = 0;
  let warrantyCount = 0;
  let pendingRefundCount = 0;
  let totalPendingSource = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;

  // Debts aggregates
  let totalDebtAmount = 0;
  let unpaidOrdersCount = 0;
  const debtCustomerIds = new Set<string>();
  let overdueOrdersCount = 0;
  const overdueCustomerIds = new Set<string>();
  let totalOverdueDebtAmount = 0;

  // Service Errors tracking
  const serviceStatsMap = new Map<string, {
    id: string;
    name: string;
    logo: string | null;
    totalOrders: number;
    errorOrders: number;
    totalRefund: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();

  // Supplier Errors tracking
  const supplierStatsMap = new Map<string, {
    id: string;
    name: string;
    totalOrders: number;
    errorOrders: number;
    debt: number;
    refunded: number;
    rejected: number;
  }>();

  // Lifetime customer aggregates
  const customerStatsMap = new Map<string, {
    id: string;
    name: string;
    phone: string | null;
    spend: number;
    netProfit: number;
  }>();

  // Monthly data for chart (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyData.push({
      month: `${d.getMonth() + 1}/${d.getFullYear()}`,
      revenue: 0,
      cost: 0,
      profit: 0,
      refunds: 0,
    });
  }

  // Loop through all orders to aggregate
  for (const o of allOrders) {
    const oDate = new Date(o.createdAt);
    const isToday = oDate >= startOfToday && oDate <= endOfToday;
    const isM0 = oDate >= startOfMonth && oDate <= endOfMonth;
    const isM1 = oDate >= startOfPrevMonth && oDate <= endOfPrevMonth;

    const isUndelivered = !o.accountEmail || o.accountEmail.trim() === '';
    if (isUndelivered && o.status !== 'EXPIRED' && o.status !== 'WARRANTY_DONE' && o.status !== 'WARRANTY_REJECTED') {
      totalUndelivered++;
    }

    if (isToday) {
      ordersTodayCount++;
      revenueToday += o.salePrice;
      costToday += o.costPrice;
    }

    const isYesterday = oDate >= startOfYesterday && oDate <= endOfYesterday;
    if (isYesterday) {
      ordersYesterdayCount++;
      revenueYesterday += o.salePrice;
      costYesterday += o.costPrice;
    }

    // Lifetime totals
    totalLifetimeRevenue += o.salePrice;
    totalLifetimeCost += o.costPrice;

    if (isM0) {
      revenueM0 += o.salePrice;
      costM0 += o.costPrice;
      countM0++;
    } else if (isM1) {
      revenueM1 += o.salePrice;
      costM1 += o.costPrice;
      countM1++;
    }

    // Chart monthly bins
    const monthStr = `${oDate.getMonth() + 1}/${oDate.getFullYear()}`;
    const chartBin = monthlyData.find(b => b.month === monthStr);
    if (chartBin) {
      chartBin.revenue += o.salePrice;
      chartBin.cost += o.costPrice;
    }

    // Warranty status counts
    const status = o.status;
    if (status === 'WARRANTY') {
      warrantyCount++;
      if (new Date(o.updatedAt) < threeDaysAgo) {
        warrantyOverdueCount++;
      }
    } else if (status === 'WARRANTY_PENDING_SOURCE') {
      warrantyCount++;
      totalPendingSource++;
    } else if (status === 'WARRANTY_PENDING_REFUND') {
      pendingRefundCount++;
    }

    // Expiry counts
    const endDate = new Date(o.endDate);
    const isUnderActive = ['ACTIVE', 'EXPIRING_SOON', 'WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(status);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    if (isUnderActive && endDate >= now && endDate <= sevenDaysLater) {
      expiringSoonCount++;
    }
    if (status === 'EXPIRED' || (isUnderActive && endDate < now)) {
      expiredCount++;
    }

    // Debt aggregates
    if (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'OVERDUE') {
      const debt = o.salePrice - o.paidAmount;
      if (debt > 0) {
        totalDebtAmount += debt;
        unpaidOrdersCount++;
        debtCustomerIds.add(o.customerId);

        const isOverdue = o.paymentStatus === 'OVERDUE' || (o.paymentDueDate && now > new Date(o.paymentDueDate));
        if (isOverdue) {
          overdueOrdersCount++;
        }
        if (o.paymentStatus === 'OVERDUE') {
          totalOverdueDebtAmount += debt;
          overdueCustomerIds.add(o.customerId);
        }
      }
    }

    // Service tracking
    if (o.service) {
      const sId = o.service.id;
      if (!serviceStatsMap.has(sId)) {
        serviceStatsMap.set(sId, {
          id: sId,
          name: o.service.name,
          logo: o.service.logo,
          totalOrders: 0,
          errorOrders: 0,
          totalRefund: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        });
      }
      const sStat = serviceStatsMap.get(sId)!;
      sStat.totalOrders++;
      sStat.revenue += o.salePrice;
      sStat.cost += o.costPrice;
      sStat.profit += (o.salePrice - o.costPrice);
      const hasError = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(o.status) || o.refundHistories.length > 0;
      if (hasError) {
        sStat.errorOrders++;
      }
    }

    // Supplier tracking
    const supId = o.supplierSourceId || 'direct';
    const supName = o.supplierSourceName || o.supplierSource?.name || 'Nguồn trực tiếp';
    if (!supplierStatsMap.has(supId)) {
      supplierStatsMap.set(supId, {
        id: supId,
        name: supName,
        totalOrders: 0,
        errorOrders: 0,
        debt: 0,
        refunded: 0,
        rejected: 0,
      });
    }
    const supStat = supplierStatsMap.get(supId)!;
    supStat.totalOrders++;
    const hasError = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(o.status) || o.refundHistories.length > 0;
    if (hasError) {
      supStat.errorOrders++;
    }

    // Lifetime Customer stats
    if (o.customer) {
      const cId = o.customerId;
      if (!customerStatsMap.has(cId)) {
        customerStatsMap.set(cId, {
          id: cId,
          name: o.customer.name,
          phone: o.customer.phone,
          spend: 0,
          netProfit: 0,
        });
      }
      const cStat = customerStatsMap.get(cId)!;
      cStat.spend += o.salePrice;
      const orderRefund = o.refundHistories.reduce((sum: number, r: any) => sum + r.amount, 0);
      const orderSrcRefund = o.refundHistories.reduce((sum: number, r: any) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);
      cStat.netProfit += (o.salePrice - o.costPrice) - orderRefund + orderSrcRefund;
    }
  }

  // Loop through all refunds to aggregate
  for (const r of allRefunds) {
    const rDate = new Date(r.createdAt);
    const isToday = rDate >= startOfToday && rDate <= endOfToday;
    const isM0 = rDate >= startOfMonth && rDate <= endOfMonth;
    const isM1 = rDate >= startOfPrevMonth && rDate <= endOfPrevMonth;

    const actualSrcRefund = r.sourceRefundActual ?? r.sourceAmount ?? 0;

    if (isToday) {
      refundToday += r.amount;
      sourceRefundToday += actualSrcRefund;
    }

    const rIsYesterday = rDate >= startOfYesterday && rDate <= endOfYesterday;
    if (rIsYesterday) {
      refundYesterday += r.amount;
      sourceRefundYesterday += actualSrcRefund;
    }

    // Lifetime refund totals
    totalLifetimeClientRefund += r.amount;
    totalLifetimeSourceRefund += actualSrcRefund;
    totalLifetimeSourceExpected += r.sourceRefundExpected || 0;
    if (r.sourceStatus === 'REJECTED') {
      totalLifetimeSourceRefundRejected += r.sourceRefundExpected || 0;
    }

    if (isM0) {
      refundM0 += r.amount;
      sourceRefundM0 += actualSrcRefund;
    } else if (isM1) {
      refundM1 += r.amount;
      sourceRefundM1 += actualSrcRefund;
    }

    // Chart refunds
    const monthStr = `${rDate.getMonth() + 1}/${rDate.getFullYear()}`;
    const chartBin = monthlyData.find(b => b.month === monthStr);
    if (chartBin) {
      chartBin.refunds += r.amount;
    }

    // Warnings and supplier debt tracking
    if (r.sourceStatus === 'PENDING') {
      const debt = r.sourceRefundExpected - r.sourceRefundActual;
      if (debt > 0) {
        totalSourceDebtPending += debt;
      }
    }

    if (r.order) {
      if (r.order.status === 'WARRANTY_PENDING_REFUND') {
        totalClientRefundPending += r.amount;
      }

      // Add refund values to services
      const sStat = serviceStatsMap.get(r.order.serviceId);
      if (sStat) {
        sStat.totalRefund += r.amount;
        sStat.profit -= r.amount;
        sStat.profit += actualSrcRefund;
      }

      // Add to supplier source
      const supId = r.order.supplierSourceId || 'direct';
      const supStat = supplierStatsMap.get(supId);
      if (supStat) {
        supStat.refunded += actualSrcRefund;
        if (r.sourceStatus === 'PENDING') {
          supStat.debt += Math.max(0, r.sourceRefundExpected - r.sourceRefundActual);
        } else if (r.sourceStatus === 'REJECTED') {
          supStat.rejected += r.sourceRefundExpected;
        }
      }
    }
  }

  // Calculate profit values for monthly data chart bins
  for (const bin of monthlyData) {
    const [m, y] = bin.month.split('/').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);

    const monthOrders = allOrders.filter((o: any) => {
      const d = new Date(o.createdAt);
      return d >= start && d <= end;
    });

    const monthRefunds = allRefunds.filter((r: any) => {
      const d = new Date(r.createdAt);
      return d >= start && d <= end;
    });

    const baseProfit = monthOrders.reduce((sum: number, o: any) => sum + (o.salePrice - o.costPrice), 0);
    const refAmt = monthRefunds.reduce((sum: number, r: any) => sum + r.amount, 0);
    const srcRefAmt = monthRefunds.reduce((sum: number, r: any) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);

    bin.profit = baseProfit - refAmt + srcRefAmt;
  }

  const profitToday = revenueToday - costToday - refundToday + sourceRefundToday;
  const profitYesterday = revenueYesterday - costYesterday - refundYesterday + sourceRefundYesterday;
  const netProfitM0 = revenueM0 - costM0 - refundM0 + sourceRefundM0;
  const netProfitM1 = revenueM1 - costM1 - refundM1 + sourceRefundM1;

  // Lifetime financial KPIs
  const totalLifetimeProfitBeforeRefund = totalLifetimeRevenue - totalLifetimeCost;
  const totalLifetimeProfitAfterRefund = totalLifetimeRevenue - totalLifetimeCost - totalLifetimeClientRefund + totalLifetimeSourceRefund;
  const totalLifetimeSourceDebt = Math.max(0, totalLifetimeSourceExpected - totalLifetimeSourceRefund);

  const getGrowthPercent = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  // Top services by error count (top 10)
  const topServiceErrors = Array.from(serviceStatsMap.values())
    .map(s => ({
      ...s,
      errorRate: s.totalOrders > 0 ? Math.round((s.errorOrders / s.totalOrders) * 100) : 0,
    }))
    .sort((a, b) => b.errorOrders - a.errorOrders)
    .slice(0, 10);

  // Top suppliers by error count
  const topSupplierErrors = Array.from(supplierStatsMap.values())
    .map(sup => ({
      ...sup,
      errorRate: sup.totalOrders > 0 ? Math.round((sup.errorOrders / sup.totalOrders) * 100) : 0,
    }))
    .sort((a, b) => b.errorOrders - a.errorOrders)
    .slice(0, 10);

  const topCustomersBySpend = Array.from(customerStatsMap.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  const topCustomersByProfit = Array.from(customerStatsMap.values())
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, 5);

  const topServicesByCount = Array.from(serviceStatsMap.values())
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 5);

  const topServicesByProfit = Array.from(serviceStatsMap.values())
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const topSourcesByCount = Array.from(supplierStatsMap.values())
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 5);

  const topSourcesByRefund = Array.from(supplierStatsMap.values())
    .sort((a, b) => b.refunded - a.refunded)
    .slice(0, 5);

  // Expiring orders in 15 days
  const fifteenDaysLater = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const expiringOrders = allOrders
    .filter((order: any) => 
      ['ACTIVE', 'EXPIRING_SOON', 'WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(order.status) &&
      new Date(order.endDate) >= now &&
      new Date(order.endDate) <= fifteenDaysLater
    )
    .sort((a: any, b: any) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
    .slice(0, 5);

  // Recent 5 orders
  const recentOrders = [...allOrders]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return {
    ordersTodayCount,
    revenueToday,
    costToday,
    refundToday,
    profitToday,
    customersTodayCount: customersCountToday,
    ordersYesterdayCount,
    revenueYesterday,
    costYesterday,
    refundYesterday,
    profitYesterday,
    // Lifetime 10-KPI financials
    totalLifetimeRevenue,
    totalLifetimeCost,
    totalLifetimeProfitBeforeRefund,
    totalLifetimeClientRefund,
    totalLifetimeSourceRefund,
    totalLifetimeSourceRefundRejected,
    totalLifetimeSourceDebt,
    totalLifetimeProfitAfterRefund,

    totalUndelivered,
    totalPendingSource,
    totalPendingRefund: pendingRefundCount,
    expiringSoonCount,
    expiredCount,
    overdueCustomersCount: overdueCustomerIds.size,
    totalOverdueDebtAmount,

    // Alerts
    totalClientRefundPending,
    totalSourceDebtPending,
    warrantyOverdueCount,
    unpaidOrdersCount,

    // Real financial M0 (this month)
    revenueThisMonth: revenueM0,
    costThisMonth: costM0,
    refundThisMonth: refundM0,
    sourceRefundThisMonth: sourceRefundM0,
    sourceDebtThisMonth: totalSourceDebtPending,
    netProfitThisMonth: netProfitM0,
    newOrdersCount: countM0,
    newCustomersCount: customersCountMonth,

    // Comparative stats
    growthStats: {
      revM0: revenueM0, costM0, netProfM0: netProfitM0, refundM0, countM0,
      revM1: revenueM1, costM1, netProfM1: netProfitM1, refundM1, countM1,
      revGrowthM0: getGrowthPercent(revenueM0, revenueM1),
      costGrowthM0: getGrowthPercent(costM0, costM1),
      profGrowthM0: getGrowthPercent(netProfitM0, netProfitM1),
      refundGrowthM0: getGrowthPercent(refundM0, refundM1),
      countGrowthM0: getGrowthPercent(countM0, countM1),
    },

    // Debts dashboard
    debtStats: {
      totalDebtAmount,
      unpaidOrdersCount,
      debtCustomersCount: debtCustomerIds.size,
      overdueOrdersCount,
    },

    // Rankings
    topCustomersBySpend,
    topCustomersByProfit,
    topServicesByCount,
    topServicesByProfit,
    topSourcesByCount,
    topSourcesByRefund,
    topServiceErrors,
    topSupplierErrors,

    recentOrders,
    expiringOrders,
    monthlyData,
  };
}

function GrowthBadge({ value }: { value: number }) {
  if (value > 0) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-bold text-emerald-400"><TrendingUp className="w-3.5 h-3.5" /> +{value}%</span>;
  }
  if (value < 0) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-bold text-rose-400"><TrendingDown className="w-3.5 h-3.5" /> -{Math.abs(value)}%</span>;
  }
  return <span className="inline-flex items-center text-xs font-bold text-slate-400">0%</span>;
}

function ComparisonRow({
  label,
  current,
  previous,
  growth,
  isCount = false,
}: {
  label: string;
  current: number;
  previous: number;
  growth: number;
  isCount?: boolean;
}) {
  const diff = current - previous;
  const isPositive = diff >= 0;
  const diffFormatted = isCount ? `${isPositive ? '+' : ''}${diff}` : `${isPositive ? '+' : ''}${formatCurrency(diff)}`;
  const currentFormatted = isCount ? `${current} đơn` : formatCurrency(current);
  const previousFormatted = isCount ? `${previous} đơn` : formatCurrency(previous);

  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all">
      <div className="space-y-1">
        <span className="text-xs font-semibold text-slate-300 block">{label}</span>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>Kỳ này: <strong className="text-white">{currentFormatted}</strong></span>
          <span>Kỳ trước: <strong className="text-slate-300">{previousFormatted}</strong></span>
        </div>
      </div>
      <div className="text-right space-y-1">
        <GrowthBadge value={growth} />
        <span className={`block text-[10px] font-mono font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {diffFormatted}
        </span>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const data = await getDashboardData();
  const now = new Date();

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📊 Dashboard CRM
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Tổng quan số liệu kinh doanh thực tế, quản lý bảo hành và công nợ.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders?create=true"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer whitespace-nowrap"
          >
            🛒 + Tạo đơn mới
          </Link>
        </div>
      </div>

      {/* Alert Banner Công nợ quá hạn */}
      {data.overdueCustomersCount > 0 && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 flex items-start justify-between gap-4 shadow-lg shadow-red-500/5 animate-pulse">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5.5 h-5.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs">
              ⚠️ CẢNH BÁO CÔNG NỢ QUÁ HẠN: Hệ thống đang có <strong className="text-white font-semibold">{data.overdueCustomersCount}</strong> khách hàng quá hạn thanh toán từ 1 ngày trở lên. Tổng nợ quá hạn: <strong className="text-white font-mono font-semibold">{formatCurrency(data.totalOverdueDebtAmount)}</strong>. Vui lòng kiểm tra và liên hệ nhắc nợ.
            </p>
          </div>
          <Link 
            href="/admin/debts" 
            className="px-3 py-1 text-[11px] rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white font-semibold border border-red-500/30 transition-all whitespace-nowrap self-center"
          >
            Chi tiết ➜
          </Link>
        </div>
      )}

      {/* SECTION: 10 CHỈ SỐ TÀI CHÍNH TỔNG THỂ */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-indigo-400" />
          <span>💰 Chỉ số tài chính tổng thể (Lifetime)</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Doanh thu tổng</span>
            <span className="text-base font-bold text-indigo-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeRevenue)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tổng giá vốn</span>
            <span className="text-base font-bold text-blue-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeCost)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">LN trước hoàn</span>
            <span className="text-base font-bold text-emerald-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeProfitBeforeRefund)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Đã hoàn trả khách</span>
            <span className="text-base font-bold text-rose-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeClientRefund)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Nguồn đã hoàn</span>
            <span className="text-base font-bold text-teal-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeSourceRefund)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Lỗ do từ chối BH</span>
            <span className="text-base font-bold text-red-500 mt-2 font-mono">{formatCurrency(data.totalLifetimeSourceRefundRejected)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">LN sau hoàn (Thực)</span>
            <span className="text-base font-bold text-cyan-400 mt-2 font-mono">{formatCurrency(data.totalLifetimeProfitAfterRefund)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Công nợ khách</span>
            <span className="text-base font-bold text-orange-400 mt-2 font-mono">{formatCurrency(data.debtStats.totalDebtAmount)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e]/40 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Công nợ nguồn</span>
            <span className="text-base font-bold text-amber-500 mt-2 font-mono">{formatCurrency(data.totalLifetimeSourceDebt)}</span>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e] border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex flex-col justify-between">
            <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Tiền thực còn lại</span>
            <span className="text-base font-extrabold text-emerald-400 mt-2 font-mono">
              {formatCurrency(
                data.totalLifetimeProfitAfterRefund - data.debtStats.totalDebtAmount + data.totalLifetimeSourceDebt
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: 2/3 Today Operational & 1/3 Today vs Yesterday Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>📅 Hôm nay (Hoạt động vận hành)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📦 Đơn chưa giao</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-extrabold text-white">{data.totalUndelivered}</span>
                <span className="text-[9px] text-slate-500">cần nạp account</span>
              </div>
            </div>
            <Link href="/admin/warranty" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-purple-500/30 transition-all flex flex-col justify-between cursor-pointer">
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">🟣 Đơn chờ nguồn</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-extrabold text-purple-400">{data.totalPendingSource}</span>
                <span className="text-[9px] text-slate-500">đang đợi hoàn →</span>
              </div>
            </Link>
            <Link href="/admin/warranty" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-orange-500/30 transition-all flex flex-col justify-between cursor-pointer">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">🟠 Khách cần hoàn</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-extrabold text-orange-400">{data.totalPendingRefund}</span>
                <span className="text-[9px] text-slate-500">chờ bấm hoàn →</span>
              </div>
            </Link>
            <Link href="/admin/subscriptions" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-yellow-500/30 transition-all flex flex-col justify-between cursor-pointer">
              <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">🟡 Đơn sắp hết hạn</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-extrabold text-yellow-400">{data.expiringSoonCount}</span>
                <span className="text-[9px] text-slate-500">&lt; 7 ngày →</span>
              </div>
            </Link>
            <Link href="/admin/subscriptions" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-red-500/30 transition-all flex flex-col justify-between cursor-pointer">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">🔴 Đơn cần gia hạn</p>
              <div className="flex items-baseline justify-between mt-3">
                <span className="text-xl font-extrabold text-rose-400">{data.expiredCount}</span>
                <span className="text-[9px] text-slate-500">đã hết hạn →</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 flex flex-col justify-between">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <span>📊 Hôm nay vs Hôm qua</span>
          </h2>
          <TodayComparisonChart
            revenueToday={data.revenueToday}
            profitToday={data.profitToday}
            revenueYesterday={data.revenueYesterday}
            profitYesterday={data.profitYesterday}
          />
        </div>
      </div>

      {/* SECTION 2: THÔNG BÁO TỰ ĐỘNG (#56) */}
      {(data.totalSourceDebtPending > 0 || data.totalClientRefundPending > 0 || data.warrantyOverdueCount > 0 || data.debtStats.unpaidOrdersCount > 0) && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Cảnh báo hệ thống</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Debts Warning */}
            {data.totalSourceDebtPending > 0 && (
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-purple-400 uppercase">🏢 Tiền nguồn chưa hoàn trả</h3>
                  <p className="text-[11px] text-slate-300">Nguồn đang nợ hoàn tiền cho các đơn hàng lỗi tổng cộng: <strong className="text-purple-300 font-mono text-xs">{formatCurrency(data.totalSourceDebtPending)}</strong>. Vui lòng đòi tiền nguồn.</p>
                </div>
              </div>
            )}
            
            {/* Client Refunds Warning */}
            {data.totalClientRefundPending > 0 && (
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-orange-400 uppercase">💸 Khách hàng đang chờ hoàn tiền</h3>
                  <p className="text-[11px] text-slate-300">Đang có <strong className="text-orange-300">{data.totalPendingRefund}</strong> đơn hàng được nguồn chấp nhận hoàn, đang chờ Admin chuyển khoản hoàn khách: <strong className="text-orange-300 font-mono text-xs">{formatCurrency(data.totalClientRefundPending)}</strong>.</p>
                </div>
              </div>
            )}

            {/* Overdue Warranty Warning */}
            {data.warrantyOverdueCount > 0 && (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                <Clock className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-rose-400 uppercase">⏳ Đơn bảo hành tồn đọng quá hạn</h3>
                  <p className="text-[11px] text-slate-300">Đang có <strong className="text-rose-300">{data.warrantyOverdueCount}</strong> đơn báo lỗi đã chờ nguồn xử lý quá 3 ngày chưa có phản hồi. Cần kiểm tra lại nguồn.</p>
                </div>
              </div>
            )}

            {/* Customer Debts Warning */}
            {data.debtStats.unpaidOrdersCount > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-rose-400 uppercase">💳 Công nợ khách hàng cần thu</h3>
                  <p className="text-[11px] text-slate-300">Đang có <strong className="text-rose-300">{data.debtStats.unpaidOrdersCount}</strong> đơn hàng chưa thanh toán từ <strong className="text-rose-300">{data.debtStats.debtCustomersCount}</strong> khách hàng. Tổng nợ: <strong className="text-rose-300 font-mono text-xs">{formatCurrency(data.debtStats.totalDebtAmount)}</strong>.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: DASHBOARD TÀI CHÍNH THỰC (#60) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">💰 Tài chính thực tháng này</h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="p-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Doanh thu bán</p>
            <p className="text-lg font-bold text-emerald-400 mt-2">{formatCurrency(data.revenueThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Tổng tiền bán đơn</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Tổng giá vốn</p>
            <p className="text-lg font-bold text-blue-400 mt-2">{formatCurrency(data.costThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Tổng tiền gốc nhập</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Đã hoàn khách</p>
            <p className="text-lg font-bold text-rose-400 mt-2">{formatCurrency(data.refundThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Hoàn đơn bảo hành</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nguồn đã hoàn</p>
            <p className="text-lg font-bold text-teal-400 mt-2">{formatCurrency(data.sourceRefundThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Thu lại từ supplier</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nguồn còn nợ</p>
            <p className="text-lg font-bold text-purple-400 mt-2">{formatCurrency(data.sourceDebtThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Supplier chưa trả</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1a1f2e] border border-indigo-500/20 hover:border-indigo-500/40 transition-all">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Lợi nhuận thực</p>
            <p className="text-lg font-extrabold text-cyan-400 mt-2">{formatCurrency(data.netProfitThisMonth)}</p>
            <p className="text-[9px] text-slate-500 mt-1">Bán - Vốn - Hoàn + Nguồn hoàn</p>
          </div>
        </div>
      </div>

      {/* SECTION 4: SO SÁNH HIỆU SUẤT TĂNG TRƯỞNG (#47) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">📈 Tăng trưởng so với tháng trước</h2>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <ComparisonRow
            label="Doanh thu"
            current={data.growthStats.revM0}
            previous={data.growthStats.revM1}
            growth={data.growthStats.revGrowthM0}
          />
          <ComparisonRow
            label="Giá vốn"
            current={data.growthStats.costM0}
            previous={data.growthStats.costM1}
            growth={data.growthStats.costGrowthM0}
          />
          <ComparisonRow
            label="Lợi nhuận thực"
            current={data.growthStats.netProfM0}
            previous={data.growthStats.netProfM1}
            growth={data.growthStats.profGrowthM0}
          />
          <ComparisonRow
            label="Hoàn tiền khách"
            current={data.growthStats.refundM0}
            previous={data.growthStats.refundM1}
            growth={data.growthStats.refundGrowthM0}
          />
          <ComparisonRow
            label="Số lượng đơn hàng"
            current={data.growthStats.countM0}
            previous={data.growthStats.countM1}
            growth={data.growthStats.countGrowthM0}
            isCount={true}
          />
        </div>
      </div>

      {/* CHART SECTION */}
      <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">📈 Xu hướng doanh thu & lợi nhuận thực</h2>
          <p className="text-xs text-slate-400 mt-0.5">Biểu đồ thống kê 6 tháng gần nhất</p>
        </div>
        <DashboardChart data={data.monthlyData} />
      </div>

      {/* SECTION 5 & 6: SERVICE ERRORS & SUPPLIER ERRORS (#45, #46) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 sản phẩm lỗi nhiều nhất */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              🚨 Top 10 sản phẩm báo lỗi nhiều nhất
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Thống kê xếp hạng theo số lượng đơn bị lỗi và tỷ lệ lỗi trên tổng đơn đã bán.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 pb-2">
                  <th className="py-2 w-10">STT</th>
                  <th className="py-2">Sản phẩm</th>
                  <th className="py-2 text-right">Đơn bán</th>
                  <th className="py-2 text-right text-rose-400">Đơn lỗi</th>
                  <th className="py-2 text-right text-rose-400">Tỷ lệ lỗi</th>
                  <th className="py-2 text-right">Hoàn khách</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {data.topServiceErrors.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 font-semibold text-white">
                      <Link href={`/admin/services/${s.id}`} className="hover:text-indigo-400 flex items-center gap-1.5 transition-all">
                        <span>{s.logo || '🔑'}</span>
                        <span>{s.name}</span>
                      </Link>
                    </td>
                    <td className="py-3 text-right">{s.totalOrders}</td>
                    <td className="py-3 text-right font-bold text-rose-400">{s.errorOrders}</td>
                    <td className="py-3 text-right font-bold text-rose-400">{s.errorRate}%</td>
                    <td className="py-3 text-right text-rose-400 font-mono">{formatCurrency(s.totalRefund)}</td>
                  </tr>
                ))}
                {data.topServiceErrors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-500">Chưa có dữ liệu bảo hành</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 nguồn lỗi nhiều nhất */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              🏢 Top 10 nguồn hàng lỗi nhiều nhất
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">Đánh giá uy tín nguồn dựa trên số lượng lỗi, tiền nguồn đang nợ hoàn hoặc từ chối.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-slate-400 pb-2">
                  <th className="py-2 w-10">STT</th>
                  <th className="py-2">Nguồn hàng</th>
                  <th className="py-2 text-right">Đơn hàng</th>
                  <th className="py-2 text-right text-rose-400">Đơn lỗi</th>
                  <th className="py-2 text-right text-purple-400">Đang nợ</th>
                  <th className="py-2 text-right text-teal-400">Đã hoàn</th>
                  <th className="py-2 text-right text-rose-500">Từ chối</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {data.topSupplierErrors.map((sup, idx) => (
                  <tr key={sup.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-3 font-semibold text-white">
                      {sup.id !== 'direct' ? (
                        <Link href={`/admin/sources/${sup.id}`} className="hover:text-indigo-400 transition-all">
                          {sup.name}
                        </Link>
                      ) : (
                        <span>{sup.name}</span>
                      )}
                    </td>
                    <td className="py-3 text-right">{sup.totalOrders}</td>
                    <td className="py-3 text-right font-bold text-rose-400">{sup.errorOrders} ({sup.errorRate}%)</td>
                    <td className="py-3 text-right text-purple-400 font-mono">{sup.debt > 0 ? formatCurrency(sup.debt) : '—'}</td>
                    <td className="py-3 text-right text-teal-400 font-mono">{sup.refunded > 0 ? formatCurrency(sup.refunded) : '—'}</td>
                    <td className="py-3 text-right text-rose-500 font-mono">{sup.rejected > 0 ? formatCurrency(sup.rejected) : '—'}</td>
                  </tr>
                ))}
                {data.topSupplierErrors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-500">Chưa có dữ liệu bảo hành nguồn</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 7: DASHBOARD CÔNG NỢ (#62) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">💳 Dashboard công nợ khách hàng</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/admin/debts" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col justify-between cursor-pointer">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">💰 Tổng nợ cần thu</p>
            <p className="text-xl font-extrabold text-white mt-3">{formatCurrency(data.debtStats.totalDebtAmount)}</p>
          </Link>
          <div className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📋 Đơn chưa thanh toán</p>
            <p className="text-xl font-extrabold text-white mt-3">{data.debtStats.unpaidOrdersCount} đơn</p>
          </div>
          <div className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">👥 Khách hàng còn nợ</p>
            <p className="text-xl font-extrabold text-white mt-3">{data.debtStats.debtCustomersCount} khách</p>
          </div>
          <Link href="/admin/debts" className="p-4.5 rounded-2xl bg-[#1e2330]/50 border border-white/5 hover:border-rose-500/30 transition-all flex flex-col justify-between cursor-pointer">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">🔥 Đơn quá hạn thanh toán</p>
            <p className="text-xl font-extrabold text-rose-500 mt-3">{data.debtStats.overdueOrdersCount} đơn</p>
          </Link>
        </div>
      </div>

      {/* BẢNG XẾP HẠNG HIỆU SUẤT SẢN PHẨM & NGUỒN HÀNG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Xếp hạng sản phẩm */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>🛍️ Top 5 Sản phẩm bán chạy</span>
              <span className="text-xs text-indigo-400 font-medium">Số đơn</span>
            </h3>
            <div className="space-y-3">
              {data.topServicesByCount.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white">{s.logo || '🔑'} {s.name}</span>
                  </div>
                  <span className="font-bold text-emerald-400">{s.totalOrders} đơn</span>
                </div>
              ))}
              {data.topServicesByCount.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>🛍️ Top 5 Sản phẩm lợi nhuận cao</span>
              <span className="text-xs text-indigo-400 font-medium">Lợi nhuận ròng</span>
            </h3>
            <div className="space-y-3">
              {data.topServicesByProfit.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white">{s.logo || '🔑'} {s.name}</span>
                  </div>
                  <span className="font-bold text-emerald-400">{formatCurrency(s.profit)}</span>
                </div>
              ))}
              {data.topServicesByProfit.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>

        {/* Xếp hạng nguồn hàng */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>📦 Top 5 Nguồn hàng bán chạy</span>
              <span className="text-xs text-indigo-400 font-medium">Số đơn</span>
            </h3>
            <div className="space-y-3">
              {data.topSourcesByCount.map((src, idx) => (
                <div key={src.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white">{src.name}</span>
                  </div>
                  <span className="font-bold text-emerald-400">{src.totalOrders} đơn</span>
                </div>
              ))}
              {data.topSourcesByCount.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>📦 Top 5 Nguồn hoàn tiền nhiều</span>
              <span className="text-xs text-indigo-400 font-medium">Hoàn nguồn thực tế</span>
            </h3>
            <div className="space-y-3">
              {data.topSourcesByRefund.map((src, idx) => (
                <div key={src.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-white">{src.name}</span>
                  </div>
                  <span className="font-bold text-rose-400">{formatCurrency(src.refunded)}</span>
                </div>
              ))}
              {data.topSourcesByRefund.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TOP LIFETIME RANKINGS & LATEST ORDERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Customers (Lifetime) */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>👤 Top 5 Khách hàng doanh số</span>
              <span className="text-xs text-indigo-400 font-medium">Chi tiêu</span>
            </h3>
            <div className="space-y-3">
              {data.topCustomersBySpend.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold text-white hover:text-indigo-400 transition-all">
                        {c.name}
                      </Link>
                      {c.phone && <p className="text-[10px] text-slate-500">{c.phone}</p>}
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">{formatCurrency(c.spend)}</span>
                </div>
              ))}
              {data.topCustomersBySpend.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-2 flex items-center justify-between">
              <span>👤 Top 5 Khách hàng lợi nhuận</span>
              <span className="text-xs text-indigo-400 font-medium">Lợi nhuận ròng</span>
            </h3>
            <div className="space-y-3">
              {data.topCustomersByProfit.map((c, idx) => (
                <div key={c.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 flex items-center justify-center rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold text-white hover:text-indigo-400 transition-all">
                        {c.name}
                      </Link>
                      {c.phone && <p className="text-[10px] text-slate-500">{c.phone}</p>}
                    </div>
                  </div>
                  <span className="font-bold text-emerald-400">{formatCurrency(c.netProfit)}</span>
                </div>
              ))}
              {data.topCustomersByProfit.length === 0 && (
                <p className="text-center text-slate-500 py-4">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>

        {/* Khách cần gia hạn gấp */}
        <div className="rounded-2xl bg-[#1a1f2e]/50 border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              ⚠️ Cần gia hạn gấp (15 ngày)
            </h2>
            <Link href="/admin/subscriptions" className="text-xs text-indigo-400 hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="space-y-3">
            {data.expiringOrders.map((order: any) => {
              const diffTime = new Date(order.endDate).getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (24 * 60 * 60 * 1000));
              const label = diffDays <= 0 ? 'Đã hết hạn' : `Còn ${diffDays} ngày`;

              return (
                <div key={order.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white/5 border border-white/3 hover:border-white/10 transition-all text-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{order.service?.logo || '🔑'}</span>
                      <strong className="text-white font-semibold">{order.service?.name}</strong>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      diffDays <= 3
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {order.customer?.id ? (
                        <Link href={`/admin/customers/${order.customer.id}`} className="hover:text-indigo-400 font-semibold transition-colors">
                          {order.customer.name}
                        </Link>
                      ) : (
                        order.customer?.name || 'N/A'
                      )} ({order.packageName})
                    </span>
                    <span className="font-mono text-slate-500">Hạn: {formatDate(order.endDate)}</span>
                  </div>
                </div>
              );
            })}
            {data.expiringOrders.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">Không có đơn hàng nào sắp hết hạn</p>
            )}
          </div>
        </div>

        {/* Đơn hàng mới nhất */}
        <div className="rounded-2xl bg-[#1a1f2e]/50 border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              🛒 Đơn hàng mới nhất
            </h2>
            <Link href="/admin/orders" className="text-xs text-indigo-400 hover:underline">
              Xem tất cả
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentOrders.map((order: any) => (
              <div
                key={order.id}
                className="p-3 rounded-xl bg-white/5 border border-white/3 hover:border-white/10 transition-all text-xs"
              >
                <div className="flex justify-between items-start">
                  <Link href={`/admin/orders/${order.id}`} className="font-bold text-indigo-400 font-mono hover:underline">
                    {order.orderCode}
                  </Link>
                  <span className="text-[10px] text-slate-500">{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{order.service?.logo || '🔑'}</span>
                    <div>
                      <p className="font-semibold text-white">{order.service?.name}</p>
                      {order.customer?.id ? (
                        <Link href={`/admin/customers/${order.customer.id}`} className="text-[10px] text-slate-400 hover:text-indigo-400 transition-all">
                          {order.customer.name}
                        </Link>
                      ) : (
                        <p className="text-[10px] text-slate-400">{order.customer?.name || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">{formatCurrency(order.salePrice)}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium mt-1 ${
                      order.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : order.status === 'REFUNDED'
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {order.status === 'ACTIVE' ? 'Đang sử dụng' :
                       order.status === 'REFUNDED' ? 'Đã hoàn tiền' :
                       order.status === 'EXPIRED' ? 'Hết hạn' : order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {data.recentOrders.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">Chưa có đơn hàng nào</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
