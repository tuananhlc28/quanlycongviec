'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, calculateRefundAmount, calculateDailyPrice, calculateUsedDays, getSubscriptionRemainingDays } from '@/lib/utils';
import { Calculator, RefreshCw, AlertCircle } from 'lucide-react';

interface RefundCalculatorProps {
  initialTotalAmount?: number;
  initialTotalDays?: number;
  initialStartDate?: string | Date;
  initialEndDate?: string | Date;
  onRefundCalculated?: (refundAmount: number) => void;
  readOnly?: boolean;
}

export default function RefundCalculator({
  initialTotalAmount = 150000,
  initialTotalDays = 30,
  initialStartDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
  initialEndDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days remaining
  onRefundCalculated,
  readOnly = false,
}: RefundCalculatorProps) {
  const [totalAmount, setTotalAmount] = useState(initialTotalAmount);
  const [totalDays, setTotalDays] = useState(initialTotalDays);
  const [startDate, setStartDate] = useState(
    typeof initialStartDate === 'string' ? initialStartDate.split('T')[0] : new Date(initialStartDate).toISOString().split('T')[0]
  );
  
  // Calculate remaining and used days dynamically based on input dates
  const [usedDays, setUsedDays] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [refundAmount, setRefundAmount] = useState(0);
  const [dailyPrice, setDailyPrice] = useState(0);

  useEffect(() => {
    const start = new Date(startDate);
    const now = new Date();
    
    // Calculate days between start and now
    const calcUsed = calculateUsedDays(start);
    setUsedDays(calcUsed);

    // Calculate remaining days
    const totalDuration = Number(totalDays);
    const calcRemaining = Math.max(0, totalDuration - calcUsed);
    setRemainingDays(calcRemaining);

    // Calculate prices
    const calcDaily = calculateDailyPrice(totalAmount, totalDuration);
    setDailyPrice(calcDaily);

    const calcRefund = calculateRefundAmount(totalAmount, totalDuration, calcRemaining);
    setRefundAmount(calcRefund);

    if (onRefundCalculated) {
      onRefundCalculated(calcRefund);
    }
  }, [totalAmount, totalDays, startDate, onRefundCalculated]);

  return (
    <div className="p-4 rounded-xl bg-white/3 border border-white/5 space-y-4 text-sm text-slate-300">
      <div className="flex items-center gap-2 text-indigo-400 font-bold">
        <Calculator className="w-5 h-5" />
        <span>Bộ tính hoàn tiền tự động</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Giá trị đơn hàng</label>
          <input
            type="number"
            value={totalAmount}
            disabled={readOnly}
            onChange={(e) => setTotalAmount(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Tổng số ngày gói</label>
          <input
            type="number"
            value={totalDays}
            disabled={readOnly}
            onChange={(e) => setTotalDays(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Ngày bắt đầu</label>
          <input
            type="date"
            value={startDate}
            disabled={readOnly}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-xs disabled:opacity-60"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
        <div className="p-2 rounded-lg bg-white/2 border border-white/3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Đã sử dụng</p>
          <p className="text-sm font-bold text-white mt-0.5">{usedDays} ngày</p>
        </div>
        <div className="p-2 rounded-lg bg-white/2 border border-white/3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Còn lại</p>
          <p className="text-sm font-bold text-indigo-400 mt-0.5">{remainingDays} ngày</p>
        </div>
        <div className="p-2 rounded-lg bg-white/2 border border-white/3">
          <p className="text-[10px] text-slate-500 uppercase font-semibold">Giá / ngày</p>
          <p className="text-sm font-bold text-slate-300 mt-0.5">{formatCurrency(dailyPrice)}</p>
        </div>
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] text-emerald-500 uppercase font-semibold">Tiền hoàn dự kiến</p>
          <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatCurrency(refundAmount)}</p>
        </div>
      </div>

      <div className="flex gap-2 items-start text-xs text-slate-500 bg-white/1 p-2 rounded-lg border border-white/3">
        <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <p>Số tiền hoàn được tính bằng công thức: <code className="text-slate-300">Giá trị / Tổng ngày * Ngày còn lại</code>. Người quản trị có thể tự điều chỉnh số tiền hoàn thực tế khi thao tác duyệt hỗ trợ.</p>
      </div>
    </div>
  );
}
