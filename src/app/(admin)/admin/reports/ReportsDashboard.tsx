'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Calendar,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Users,
  TrendingUp,
  RefreshCw,
  TrendingDown,
  Info,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  User,
  ShieldCheck,
  TrendingUp as TrendUpIcon
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ReportsDashboardProps {
  orders: any[];
  refunds: any[];
  customers: any[];
}

export default function ReportsDashboard({ orders, refunds, customers }: ReportsDashboardProps) {
  const [preset, setPreset] = useState('30days');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Initialize date inputs
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    setStartDateStr(start.toISOString().split('T')[0]);
    setEndDateStr(end.toISOString().split('T')[0]);
  }, []);

  // Compute start/end date based on preset
  const dateRange = useMemo(() => {
    let end = new Date();
    end.setHours(23, 59, 59, 999);
    let start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (preset) {
      case 'today':
        break;
      case '7days':
        start.setDate(end.getDate() - 6);
        break;
      case '30days':
        start.setDate(end.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        break;
      case 'thisYear':
        start = new Date(end.getFullYear(), 0, 1);
        break;
      case 'custom':
        if (startDateStr) {
          start = new Date(startDateStr);
          start.setHours(0, 0, 0, 0);
        }
        if (endDateStr) {
          end = new Date(endDateStr);
          end.setHours(23, 59, 59, 999);
        }
        break;
      default:
        start.setDate(end.getDate() - 29);
    }

    return { start, end };
  }, [preset, startDateStr, endDateStr]);

  const filteredOrders = useMemo(() => {
    const { start, end } = dateRange;
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= start && d <= end;
    });
  }, [orders, dateRange]);

  const filteredRefunds = useMemo(() => {
    const { start, end } = dateRange;
    return refunds.filter(r => {
      const d = new Date(r.createdAt);
      return d >= start && d <= end;
    });
  }, [refunds, dateRange]);

  const filteredCustomers = useMemo(() => {
    const { start, end } = dateRange;
    return customers.filter(c => {
      const d = new Date(c.createdAt);
      return d >= start && d <= end;
    });
  }, [customers, dateRange]);

  // Helper: Format date for Recharts Y-axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(value);
  };

  // Helper: Check if two dates fall in the same bin
  const getBinLabel = (date: Date, binType: 'day' | 'month' | 'year') => {
    if (binType === 'month') {
      return `${date.getMonth() + 1}/${date.getFullYear()}`;
    }
    if (binType === 'year') {
      return `${date.getFullYear()}`;
    }
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  // Time-Series Binned Data
  const chartData = useMemo(() => {
    const { start, end } = dateRange;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let binType: 'day' | 'month' | 'year' = 'day';
    if (diffDays > 365) binType = 'year';
    else if (diffDays > 31) binType = 'month';

    const bins = new Map<string, any>();

    // Generate consecutive bins
    let current = new Date(start);
    while (current <= end) {
      const label = getBinLabel(current, binType);
      if (!bins.has(label)) {
        bins.set(label, {
          label,
          revenue: 0,
          cost: 0,
          profit: 0,
          orders: 0,
          errors: 0,
          refundClient: 0,
          refundSource: 0,
          profitImpact: 0,
          newCustomers: 0,
          returningCustomers: 0,
          totalCustomers: 0,
          customerIds: new Set<string>(),
        });
      }
      
      if (binType === 'day') {
        current.setDate(current.getDate() + 1);
      } else if (binType === 'month') {
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      } else {
        current = new Date(current.getFullYear() + 1, 0, 1);
      }
    }

    // Process Orders in range
    filteredOrders.forEach(o => {
      const oDate = new Date(o.createdAt);
      const label = getBinLabel(oDate, binType);
      const bin = bins.get(label);
      if (bin) {
        bin.revenue += o.salePrice;
        bin.cost += o.costPrice;
        bin.orders += 1;
        
        const isError = ['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND', 'WARRANTY_DONE', 'WARRANTY_REJECTED'].includes(o.status);
        if (isError) {
          bin.errors += 1;
        }

        if (o.customerId) {
          bin.customerIds.add(o.customerId);
        }
      }
    });

    // Process Refunds in range
    filteredRefunds.forEach(r => {
      const rDate = new Date(r.createdAt);
      const label = getBinLabel(rDate, binType);
      const bin = bins.get(label);
      if (bin) {
        bin.refundClient += r.amount;
        bin.refundSource += (r.sourceRefundActual || 0);
        bin.profitImpact += (r.amount - (r.sourceRefundActual || 0));
      }
    });

    // Process Customers (New vs Returning) in range
    filteredCustomers.forEach(c => {
      const cDate = new Date(c.createdAt);
      const label = getBinLabel(cDate, binType);
      const bin = bins.get(label);
      if (bin) {
        bin.newCustomers += 1;
      }
    });

    // Fill customer totals and returning customers
    bins.forEach(bin => {
      bin.totalCustomers = bin.customerIds.size;
      bin.returningCustomers = Math.max(0, bin.totalCustomers - bin.newCustomers);
      bin.profit = bin.revenue - bin.cost - bin.refundClient + bin.refundSource;
    });

    return Array.from(bins.values());
  }, [filteredOrders, filteredRefunds, filteredCustomers, dateRange]);

  // Comparison Metrics Calculations
  const comparisonStats = useMemo(() => {
    const now = new Date();
    
    // Boundaries
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = new Date(startOfYesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Orders filters
    const ordersToday = orders.filter(o => { const d = new Date(o.createdAt); return d >= startOfToday && d <= endOfToday; });
    const ordersYesterday = orders.filter(o => { const d = new Date(o.createdAt); return d >= startOfYesterday && d <= endOfYesterday; });
    const ordersM0 = orders.filter(o => { const d = new Date(o.createdAt); return d >= startOfMonth && d <= endOfMonth; });
    const ordersM1 = orders.filter(o => { const d = new Date(o.createdAt); return d >= startOfPrevMonth && d <= endOfPrevMonth; });

    // Refunds filters
    const refundsToday = refunds.filter(r => { const d = new Date(r.createdAt); return d >= startOfToday && d <= endOfToday; });
    const refundsYesterday = refunds.filter(r => { const d = new Date(r.createdAt); return d >= startOfYesterday && d <= endOfYesterday; });
    const refundsM0 = refunds.filter(r => { const d = new Date(r.createdAt); return d >= startOfMonth && d <= endOfMonth; });
    const refundsM1 = refunds.filter(r => { const d = new Date(r.createdAt); return d >= startOfPrevMonth && d <= endOfPrevMonth; });

    // Today vs Yesterday Calculations
    const revToday = ordersToday.reduce((sum, o) => sum + o.salePrice, 0);
    const revYest = ordersYesterday.reduce((sum, o) => sum + o.salePrice, 0);

    const costToday = ordersToday.reduce((sum, o) => sum + o.costPrice, 0);
    const costYest = ordersYesterday.reduce((sum, o) => sum + o.costPrice, 0);

    const refToday = refundsToday.reduce((sum, r) => sum + r.amount, 0);
    const refYest = refundsYesterday.reduce((sum, r) => sum + r.amount, 0);

    const srcRefToday = refundsToday.reduce((sum, r) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);
    const srcRefYest = refundsYesterday.reduce((sum, r) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);

    const profToday = revToday - costToday - refToday + srcRefToday;
    const profYest = revYest - costYest - refYest + srcRefYest;

    const countToday = ordersToday.length;
    const countYest = ordersYesterday.length;

    const custToday = new Set(ordersToday.map(o => o.customerId)).size;
    const custYest = new Set(ordersYesterday.map(o => o.customerId)).size;

    // Month vs Month Calculations
    const revM0 = ordersM0.reduce((sum, o) => sum + o.salePrice, 0);
    const revM1 = ordersM1.reduce((sum, o) => sum + o.salePrice, 0);

    const costM0 = ordersM0.reduce((sum, o) => sum + o.costPrice, 0);
    const costM1 = ordersM1.reduce((sum, o) => sum + o.costPrice, 0);

    const refM0 = refundsM0.reduce((sum, r) => sum + r.amount, 0);
    const refM1 = refundsM1.reduce((sum, r) => sum + r.amount, 0);

    const srcRefM0 = refundsM0.reduce((sum, r) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);
    const srcRefM1 = refundsM1.reduce((sum, r) => sum + (r.sourceRefundActual ?? r.sourceAmount ?? 0), 0);

    const profM0 = revM0 - costM0 - refM0 + srcRefM0;
    const profM1 = revM1 - costM1 - refM1 + srcRefM1;

    const countM0 = ordersM0.length;
    const countM1 = ordersM1.length;

    const custM0 = new Set(ordersM0.map(o => o.customerId)).size;
    const custM1 = new Set(ordersM1.map(o => o.customerId)).size;

    return {
      today: { revenue: revToday, profit: profToday, count: countToday, customers: custToday, refund: refToday },
      yesterday: { revenue: revYest, profit: profYest, count: countYest, customers: custYest, refund: refYest },
      thisMonth: { revenue: revM0, profit: profM0, count: countM0, customers: custM0, cost: costM0, refund: refM0 },
      prevMonth: { revenue: revM1, profit: profM1, count: countM1, customers: custM1, cost: costM1, refund: refM1 }
    };
  }, [orders, refunds]);

  // (2) Order count/financial statistics grouped by Service
  const serviceStats = useMemo(() => {
    const map = new Map<string, { name: string, logo: string, ordersCount: number, revenue: number, profit: number }>();
    filteredOrders.forEach(o => {
      const name = o.service?.name || 'Khác';
      const logo = o.service?.logo || '🔑';
      if (!map.has(name)) {
        map.set(name, { name, logo, ordersCount: 0, revenue: 0, profit: 0 });
      }
      const item = map.get(name)!;
      item.ordersCount += 1;
      item.revenue += o.salePrice;
      
      let initialProfit = o.salePrice - o.costPrice;
      o.refundHistories?.forEach((r: any) => {
        initialProfit = initialProfit - r.amount + (r.sourceRefundActual ?? r.sourceAmount ?? 0);
      });
      item.profit += initialProfit;
    });
    return Array.from(map.values()).sort((a, b) => b.ordersCount - a.ordersCount);
  }, [filteredOrders]);

  // (4) Supplier source stats
  const sourceStats = useMemo(() => {
    const map = new Map<string, { name: string, ordersCount: number, revenue: number, profit: number, refundsCount: number }>();
    filteredOrders.forEach(o => {
      const name = o.supplierSourceName || o.supplierSource?.name || 'Nguồn trực tiếp';
      if (!map.has(name)) {
        map.set(name, { name, ordersCount: 0, revenue: 0, profit: 0, refundsCount: 0 });
      }
      const item = map.get(name)!;
      item.ordersCount += 1;
      item.revenue += o.salePrice;
      
      let initialProfit = o.salePrice - o.costPrice;
      o.refundHistories?.forEach((r: any) => {
        initialProfit = initialProfit - r.amount + (r.sourceRefundActual ?? r.sourceAmount ?? 0);
        item.refundsCount += 1;
      });
      item.profit += initialProfit;
    });
    return Array.from(map.values()).sort((a, b) => b.ordersCount - a.ordersCount);
  }, [filteredOrders]);

  // (6) Top 10 Customers in range
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string, phone: string, spend: number, ordersCount: number, profit: number }>();
    filteredOrders.forEach(o => {
      const cId = o.customerId;
      const name = o.customer?.name || 'Ẩn danh';
      const phone = o.customer?.phone || '';
      if (!map.has(cId)) {
        map.set(cId, { name, phone, spend: 0, ordersCount: 0, profit: 0 });
      }
      const item = map.get(cId)!;
      item.ordersCount += 1;
      item.spend += o.salePrice;
      let initialProfit = o.salePrice - o.costPrice;
      o.refundHistories?.forEach((r: any) => {
        initialProfit = initialProfit - r.amount + (r.sourceRefundActual ?? r.sourceAmount ?? 0);
      });
      item.profit += initialProfit;
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [filteredOrders]);

  // (7) Top Services
  const topServices = useMemo(() => {
    return [...serviceStats].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [serviceStats]);

  // (8) Order Statuses Distribution
  const statusStats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let warranty = 0;
    let refunded = 0;
    let cancelled = 0;

    filteredOrders.forEach(o => {
      if (['ACTIVE', 'EXPIRING_SOON'].includes(o.status)) active++;
      else if (o.status === 'EXPIRED') expired++;
      else if (['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(o.status)) warranty++;
      else if (o.status === 'WARRANTY_DONE') refunded++;
      else cancelled++;
    });

    return [
      { name: 'Đang hoạt động', value: active, color: '#10b981' },
      { name: 'Hết hạn', value: expired, color: '#64748b' },
      { name: 'Đang bảo hành', value: warranty, color: '#fbbf24' },
      { name: 'Đã hoàn tiền', value: refunded, color: '#f43f5e' },
      { name: 'Đã hủy / Khác', value: cancelled, color: '#a855f7' },
    ].filter(item => item.value > 0);
  }, [filteredOrders]);

  // (9) Locked Last 30 Days Trend Data
  const last30DaysTrendData = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    
    const bins = new Map<string, any>();
    let current = new Date(start);
    while (current <= end) {
      const label = `${current.getDate()}/${current.getMonth() + 1}`;
      bins.set(label, { label, revenue: 0, cost: 0, profit: 0, orders: 0 });
      current.setDate(current.getDate() + 1);
    }

    orders.forEach(o => {
      const oDate = new Date(o.createdAt);
      if (oDate >= start && oDate <= end) {
        const label = `${oDate.getDate()}/${oDate.getMonth() + 1}`;
        const bin = bins.get(label);
        if (bin) {
          bin.revenue += o.salePrice;
          bin.cost += o.costPrice;
          bin.orders += 1;
        }
      }
    });

    refunds.forEach(r => {
      const rDate = new Date(r.createdAt);
      if (rDate >= start && rDate <= end) {
        const label = `${rDate.getDate()}/${rDate.getMonth() + 1}`;
        const bin = bins.get(label);
        if (bin) {
          bin.profit -= r.amount;
          bin.profit += (r.sourceRefundActual || 0);
        }
      }
    });

    bins.forEach(bin => {
      bin.profit += (bin.revenue - bin.cost);
    });

    return Array.from(bins.values());
  }, [orders, refunds]);

  // Helper Comparison Card Component
  const ComparisonCard = ({
    title,
    todayValue,
    yesterdayValue,
    isCurrency = false,
    reverseColor = false,
    yesterdayLabel,
    todayLabel
  }: {
    title: string;
    todayValue: number;
    yesterdayValue: number;
    isCurrency?: boolean;
    reverseColor?: boolean;
    yesterdayLabel: string;
    todayLabel: string;
  }) => {
    const diff = todayValue - yesterdayValue;
    const percent = yesterdayValue === 0 
      ? (todayValue > 0 ? 100 : 0) 
      : Math.round((diff / yesterdayValue) * 100);

    const isNeutral = diff === 0;
    const isPositive = diff > 0;
    
    let isGood = isPositive;
    if (reverseColor) {
      isGood = !isPositive;
    }

    const badgeColor = isNeutral
      ? 'bg-slate-500/10 text-slate-400 border border-slate-500/15'
      : isGood
      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
      : 'bg-rose-500/10 text-rose-400 border border-rose-500/15';

    const textHighlightColor = isNeutral
      ? 'text-slate-400'
      : isGood
      ? 'text-emerald-400'
      : 'text-rose-400';

    const formattedDiff = isCurrency ? formatCurrency(Math.abs(diff)) : Math.abs(diff);

    const chartData = [
      { name: yesterdayLabel, value: yesterdayValue },
      { name: todayLabel, value: todayValue }
    ];

    return (
      <div className="bg-[#1a1f2e]/60 p-4 rounded-xl border border-white/5 flex flex-col justify-between h-[155px]">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-black block tracking-wider">{title}</span>
          <p className="text-base font-black text-white mt-1 leading-tight">
            {isCurrency ? formatCurrency(todayValue) : todayValue}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {yesterdayLabel}: <span className="font-mono">{isCurrency ? formatCurrency(yesterdayValue) : yesterdayValue}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-1 mt-2">
          <div className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-0.5 ${badgeColor}`}>
            {!isNeutral && (isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
            {isNeutral ? '0%' : `${isPositive ? '+' : ''}${percent}%`}
          </div>
          <span className={`text-[10px] font-mono font-bold ${textHighlightColor}`}>
            {isNeutral ? '0đ' : `${diff > 0 ? '+' : '-'}${formattedDiff}`}
          </span>
        </div>

        <div className="h-[40px] w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: -30, right: 0, top: 0, bottom: 0 }}>
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Bar 
                dataKey="value" 
                fill={isNeutral ? '#64748b' : isGood ? '#10b981' : '#f43f5e'} 
                radius={[2, 2, 0, 0]} 
                maxBarSize={14} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Đang chuẩn bị biểu đồ thống kê...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white pb-12">
      {/* Date Preset Selection Form */}
      <div className="bg-[#131722]/60 p-5 rounded-2xl border border-white/5 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold mr-2">Chọn nhanh khoảng lọc:</span>
            {[
              { label: 'Hôm nay', value: 'today' },
              { label: '7 ngày', value: '7days' },
              { label: '30 ngày', value: '30days' },
              { label: 'Tháng này', value: 'thisMonth' },
              { label: 'Năm nay', value: 'thisYear' },
              { label: 'Khoảng tự chọn', value: 'custom' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all cursor-pointer border ${
                  preset === p.value
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-slate-400 font-mono text-xs">
            Phạm vi lọc: {dateRange.start.toLocaleDateString('vi-VN')} → {dateRange.end.toLocaleDateString('vi-VN')}
          </span>
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-white/5 animate-fade-in">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Từ ngày</span>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-[#1e2330] border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Đến ngày</span>
              <input
                type="date"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-[#1e2330] border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* COMPARISONS SECTION ON TOP */}
      <div className="space-y-6">
        
        {/* Biểu đồ 1: So sánh Hôm nay ↔ Hôm qua */}
        <div className="bg-[#131722]/40 p-5 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            BIỂU ĐỒ 1: SO SÁNH HÔM NAY ↔ HÔM QUA (DAILY METRICS)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ComparisonCard
              title="Doanh thu"
              todayValue={comparisonStats.today.revenue}
              yesterdayValue={comparisonStats.yesterday.revenue}
              isCurrency={true}
              yesterdayLabel="Hôm qua"
              todayLabel="Hôm nay"
            />
            <ComparisonCard
              title="Lợi nhuận"
              todayValue={comparisonStats.today.profit}
              yesterdayValue={comparisonStats.yesterday.profit}
              isCurrency={true}
              yesterdayLabel="Hôm qua"
              todayLabel="Hôm nay"
            />
            <ComparisonCard
              title="Số lượng đơn"
              todayValue={comparisonStats.today.count}
              yesterdayValue={comparisonStats.yesterday.count}
              yesterdayLabel="Hôm qua"
              todayLabel="Hôm nay"
            />
            <ComparisonCard
              title="Số khách mua"
              todayValue={comparisonStats.today.customers}
              yesterdayValue={comparisonStats.yesterday.customers}
              yesterdayLabel="Hôm qua"
              todayLabel="Hôm nay"
            />
            <ComparisonCard
              title="Tiền hoàn trả"
              todayValue={comparisonStats.today.refund}
              yesterdayValue={comparisonStats.yesterday.refund}
              isCurrency={true}
              reverseColor={true} // Refunds are negative, so increase is bad
              yesterdayLabel="Hôm qua"
              todayLabel="Hôm nay"
            />
          </div>
        </div>

        {/* Biểu đồ 2: So sánh Tháng này ↔ Tháng trước */}
        <div className="bg-[#131722]/40 p-5 rounded-2xl border border-white/5 space-y-4">
          <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            BIỂU ĐỒ 2: SO SÁNH THÁNG NÀY ↔ THÁNG TRƯỚC (MONTHLY METRICS)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <ComparisonCard
              title="Doanh thu"
              todayValue={comparisonStats.thisMonth.revenue}
              yesterdayValue={comparisonStats.prevMonth.revenue}
              isCurrency={true}
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
            <ComparisonCard
              title="Lợi nhuận"
              todayValue={comparisonStats.thisMonth.profit}
              yesterdayValue={comparisonStats.prevMonth.profit}
              isCurrency={true}
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
            <ComparisonCard
              title="Số lượng đơn"
              todayValue={comparisonStats.thisMonth.count}
              yesterdayValue={comparisonStats.prevMonth.count}
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
            <ComparisonCard
              title="Số khách"
              todayValue={comparisonStats.thisMonth.customers}
              yesterdayValue={comparisonStats.prevMonth.customers}
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
            <ComparisonCard
              title="Chi phí vốn"
              todayValue={comparisonStats.thisMonth.cost}
              yesterdayValue={comparisonStats.prevMonth.cost}
              isCurrency={true}
              reverseColor={true} // Cost increase is negative for performance rating
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
            <ComparisonCard
              title="Tiền hoàn trả"
              todayValue={comparisonStats.thisMonth.refund}
              yesterdayValue={comparisonStats.prevMonth.refund}
              isCurrency={true}
              reverseColor={true}
              yesterdayLabel="Tháng trước"
              todayLabel="Tháng này"
            />
          </div>
        </div>

      </div>

      {/* CORE STATISTICAL CHARTS (GRID 1 COLUMN) */}
      <div className="grid grid-cols-1 gap-6">

        {/* (1) Doanh thu & Lợi nhuận theo thời gian */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              (1) Biểu đồ Doanh thu & Lợi nhuận theo thời gian
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Biểu đồ tổng hợp doanh thu và lợi nhuận thực tế (đối chiếu theo ngày/tháng/năm)</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-slate-400 mb-1">{item.label}</p>
                          <p className="text-indigo-400 font-bold">Doanh thu: {formatCurrency(item.revenue)}</p>
                          <p className="text-emerald-400 font-bold">Lợi nhuận: {formatCurrency(item.profit)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Doanh thu" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Line name="Lợi nhuận" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* (2) Đơn hàng theo dịch vụ */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              (2) Biểu đồ Đơn hàng theo dịch vụ
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Thống kê doanh số bán và lợi nhuận phân chia cụ thể theo từng sản phẩm dịch vụ</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceStats} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-white mb-1">{item.logo} {item.name}</p>
                          <p className="text-slate-400">Số đơn bán: <strong className="text-white">{item.ordersCount} đơn</strong></p>
                          <p className="text-indigo-400 font-bold">Doanh thu: {formatCurrency(item.revenue)}</p>
                          <p className="text-emerald-400 font-bold">Lợi nhuận: {formatCurrency(item.profit)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Doanh thu" dataKey="revenue" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={25} />
                <Bar name="Lợi nhuận" dataKey="profit" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* (3) Khách hàng mới và khách hàng quay lại */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              (3) Biểu đồ Khách hàng mới và Khách hàng quay lại
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Tỷ lệ tương quan giữa tài khoản đăng ký mới và lượng khách hàng thân thiết quay lại giao dịch</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-slate-400 mb-1">{item.label}</p>
                          <p className="text-sky-400">Khách mới: {item.newCustomers} khách</p>
                          <p className="text-amber-400">Khách quay lại: {item.returningCustomers} khách</p>
                          <p className="text-white font-bold border-t border-white/5 pt-1">Tổng cộng: {item.totalCustomers} khách</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Khách mới" dataKey="newCustomers" fill="#38bdf8" stackId="a" maxBarSize={30} />
                <Bar name="Khách quay lại" dataKey="returningCustomers" fill="#fbbf24" stackId="a" radius={[3, 3, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* (4) Nguồn hàng */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              (4) Thống kê hiệu suất Nguồn hàng
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Phân tích hiệu quả kinh doanh, số đơn hàng cung cấp, doanh thu, lợi nhuận, và tỉ lệ sự cố từ nguồn</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceStats} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-white mb-1">🏢 {item.name}</p>
                          <p className="text-slate-400">Số đơn: <strong className="text-white">{item.ordersCount} đơn</strong></p>
                          <p className="text-indigo-400 font-bold">Doanh thu: {formatCurrency(item.revenue)}</p>
                          <p className="text-emerald-400 font-bold">Lợi nhuận: {formatCurrency(item.profit)}</p>
                          <p className="text-rose-400 font-bold border-t border-white/5 pt-1">Hoàn tiền bảo hành: {item.refundsCount} lần</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Doanh thu" dataKey="revenue" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={25} />
                <Bar name="Lợi nhuận" dataKey="profit" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* (5) Biểu đồ hoàn tiền */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-rose-400" />
              (5) Biểu đồ Chi tiết Hoàn tiền & Ảnh hưởng Lợi nhuận
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">So sánh tiền hoàn khách thực tế, nguồn hoàn và số tiền trực tiếp giảm trừ lợi nhuận kinh doanh</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-slate-400 mb-1">{item.label}</p>
                          <p className="text-rose-400">Hoàn trả khách: -{formatCurrency(item.refundClient)}</p>
                          <p className="text-emerald-400">Nhận nguồn hoàn: +{formatCurrency(item.refundSource)}</p>
                          <p className="text-purple-400 font-bold border-t border-white/5 pt-1">
                            Lợi nhuận bị giảm: -{formatCurrency(item.profitImpact)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Hoàn trả khách" dataKey="refundClient" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar name="Nhận nguồn hoàn" dataKey="refundSource" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar name="Chênh lệch giảm" dataKey="profitImpact" fill="#a855f7" radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* (6) Top 10 khách hàng */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              (6) Xếp hạng Top 10 Khách hàng giá trị nhất
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Xếp hạng khách hàng theo tổng chi tiêu và lợi nhuận ròng mang lại</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="py-2.5 pl-2">Khách hàng</th>
                  <th className="py-2.5">Số đơn</th>
                  <th className="py-2.5">Tổng chi tiêu</th>
                  <th className="py-2.5 pr-2">Lợi nhuận ròng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {topCustomers.map((c, i) => (
                  <tr key={c.name + i} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 pl-2">
                      <div>
                        <p className="font-bold text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.phone || 'Không có SĐT'}</p>
                      </div>
                    </td>
                    <td className="py-3 font-semibold font-mono">{c.ordersCount} đơn</td>
                    <td className="py-3 font-semibold font-mono text-emerald-400">
                      {formatCurrency(c.spend)}
                    </td>
                    <td className={`py-3 font-bold font-mono ${c.profit >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                      {formatCurrency(c.profit)}
                    </td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">Chưa có dữ liệu giao dịch</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* (7) Top dịch vụ */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-yellow-400" />
              (7) Xếp hạng Top Dịch vụ
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Xếp hạng các gói dịch vụ bán chạy nhất theo doanh thu thu được</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-slate-400">
                  <th className="py-2.5 pl-2">Sản phẩm dịch vụ</th>
                  <th className="py-2.5">Số lượng bán</th>
                  <th className="py-2.5">Doanh thu</th>
                  <th className="py-2.5 pr-2">Lợi nhuận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {topServices.map((s, i) => (
                  <tr key={s.name + i} className="hover:bg-white/2 transition-colors">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{s.logo}</span>
                        <span className="font-bold text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-semibold font-mono">{s.ordersCount} đơn</td>
                    <td className="py-3 font-semibold font-mono text-emerald-400">
                      {formatCurrency(s.revenue)}
                    </td>
                    <td className="py-3 font-bold font-mono text-indigo-400">
                      {formatCurrency(s.profit)}
                    </td>
                  </tr>
                ))}
                {topServices.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 italic">Chưa có dữ liệu giao dịch</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* (8) Tình trạng đơn hàng */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              (8) Biểu đồ Trạng thái Đơn hàng
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Tỉ lệ phân bố các trạng thái đơn hàng hiện tại trong hệ thống CRM</p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-around gap-6">
            <div className="h-[180px] w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="p-2 bg-[#121520] border border-white/10 text-[10px] rounded shadow-2xl">
                            <p className="font-bold text-white">{payload[0].name}: {payload[0].value} đơn</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="space-y-2.5 text-xs w-full md:w-auto">
              {statusStats.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full block" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-medium min-w-[120px]">{item.name}:</span>
                  <strong className="text-white font-mono">{item.value} đơn</strong>
                </div>
              ))}
              {statusStats.length === 0 && (
                <p className="text-slate-500 italic">Chưa ghi nhận đơn hàng nào</p>
              )}
            </div>
          </div>
        </div>

        {/* (9) Biểu đồ xu hướng 30 ngày gần nhất */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/60 border border-white/5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              (9) Biểu đồ xu hướng 30 ngày gần nhất
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Biểu đồ thống kê liên tiếp 30 ngày gần nhất về Doanh thu, Lợi nhuận và số lượng đơn hàng</p>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={last30DaysTrendData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatYAxis} />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload;
                      return (
                        <div className="p-3.5 rounded-xl bg-[#121520] border border-white/10 shadow-2xl text-xs space-y-1">
                          <p className="font-bold text-slate-400 mb-1">{item.label}</p>
                          <p className="text-indigo-400">Doanh thu: {formatCurrency(item.revenue)}</p>
                          <p className="text-emerald-400 font-bold">Lợi nhuận: {formatCurrency(item.profit)}</p>
                          <p className="text-white font-medium border-t border-white/5 pt-1">Số đơn: {item.orders} đơn</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                <Bar name="Doanh thu" dataKey="revenue" fill="#6366f1" radius={[2, 2, 0, 0]} maxBarSize={15} />
                <Line name="Lợi nhuận" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
