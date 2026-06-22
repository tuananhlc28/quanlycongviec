"use client";

import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface MonthlyData {
  month: string;
  revenue: number;
  profit: number;
  refunds: number;
}

interface DashboardChartProps {
  data: MonthlyData[];
}

export default function DashboardChart({ data }: DashboardChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-80 rounded-2xl bg-white/5 border border-white/5 animate-pulse flex items-center justify-center text-slate-500">
        Đang tải biểu đồ...
      </div>
    );
  }

  // Format currency for Y-Axis
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-4 rounded-xl glass border border-white/10 shadow-xl space-y-1.5 text-xs">
          <p className="font-bold text-white mb-2">Tháng {label}</p>
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}:
              </span>
              <span className="font-semibold" style={{ color: item.color }}>
                {formatCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorRefunds" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="rgba(255, 255, 255, 0.4)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(255, 255, 255, 0.4)"
            fontSize={11}
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
            wrapperStyle={{
              fontSize: '12px',
              paddingBottom: '10px',
            }}
          />
          <Area
            type="monotone"
            name="Doanh thu"
            dataKey="revenue"
            stroke="#6366f1"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
          <Area
            type="monotone"
            name="Lợi nhuận ròng"
            dataKey="profit"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorProfit)"
          />
          <Area
            type="monotone"
            name="Hoàn tiền"
            dataKey="refunds"
            stroke="#f43f5e"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRefunds)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
