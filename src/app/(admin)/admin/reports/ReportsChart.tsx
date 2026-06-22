'use client';

import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface ChartStat {
  label: string;
  date: string;
  revenue: number;
  profit: number;
  refunds: number;
  orders: number;
}

interface ReportsChartProps {
  data: ChartStat[];
}

export default function ReportsChart({ data }: ReportsChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[250px] w-full bg-white/2 rounded-xl animate-pulse"></div>;
  }

  const chartData = data.map((item) => ({
    ...item,
    formattedDate: item.label || item.date,
  }));

  // Custom currency formatting for Y-Axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(value);
  };

  // Custom tooltips matching theme
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#121520] border border-slate-200 dark:border-white/10 p-3 rounded-xl shadow-2xl text-xs space-y-1 text-slate-800 dark:text-white">
          <p className="text-slate-400 font-medium mb-1.5">{payload[0].payload.label || payload[0].payload.date}</p>
          <p className="flex justify-between gap-4">
            <span>Doanh thu:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[0].value)}
            </span>
          </p>
          {payload[1] !== undefined && (
            <p className="flex justify-between gap-4">
              <span>Lợi nhuận ròng:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[1].value)}
              </span>
            </p>
          )}
          {payload[2] !== undefined && (
            <p className="flex justify-between gap-4">
              <span>Hoàn tiền:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payload[2].value)}
              </span>
            </p>
          )}
          <p className="text-slate-500 text-[10px] mt-1 pt-1 border-t border-slate-100 dark:border-white/5">
            Số đơn hàng: {payload[0].payload.orders}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
        <XAxis
          dataKey="formattedDate"
          stroke="#64748b"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#64748b"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatYAxis}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px' }}
        />
        <Bar
          name="Doanh thu"
          dataKey="revenue"
          fill="url(#colorRevenue)"
          stroke="#6366f1"
          strokeWidth={1}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
        <Line
          name="Lợi nhuận ròng"
          type="monotone"
          dataKey="profit"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
        <Line
          name="Hoàn tiền"
          type="monotone"
          dataKey="refunds"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
