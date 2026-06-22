'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

interface TodayComparisonChartProps {
  revenueToday: number;
  profitToday: number;
  revenueYesterday: number;
  profitYesterday: number;
}

export default function TodayComparisonChart({
  revenueToday,
  profitToday,
  revenueYesterday,
  profitYesterday,
}: TodayComparisonChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-80 rounded-2xl bg-white/5 border border-white/5 animate-pulse flex items-center justify-center text-slate-500">
        Đang tải biểu đồ so sánh...
      </div>
    );
  }

  const data = [
    {
      name: 'Doanh thu',
      'Hôm qua': revenueYesterday,
      'Hôm nay': revenueToday,
    },
    {
      name: 'Lợi nhuận ròng',
      'Hôm qua': profitYesterday,
      'Hôm nay': profitToday,
    },
  ];

  const formatYAxis = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-4 rounded-xl glass border border-white/10 shadow-xl space-y-1.5 text-xs">
          <p className="font-bold text-white mb-2">{label}</p>
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: item.color }}
                />
                {item.name}:
              </span>
              <span className="font-bold" style={{ color: item.color }}>
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
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 10,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
          <XAxis
            dataKey="name"
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
          <Bar name="Hôm qua" dataKey="Hôm qua" fill="#475569" radius={[4, 4, 0, 0]} />
          <Bar name="Hôm nay" dataKey="Hôm nay" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
