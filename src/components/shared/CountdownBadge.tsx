'use client';

import { useState, useEffect } from 'react';

interface CountdownBadgeProps {
  endDate: string | Date;
  status: string;
}

export function CountdownBadge({ endDate, status }: CountdownBadgeProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();

  let text = '';
  let badgeColor = '';

  // Check if order has a warning status first
  if (['WARRANTY', 'WARRANTY_PENDING_SOURCE', 'WARRANTY_PENDING_REFUND'].includes(status)) {
    text = 'Có sự cố';
    badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold';
  } else if (diffMs < 0) {
    // Overdue
    const absDiffMs = Math.abs(diffMs);
    if (absDiffMs < 60 * 60 * 1000) {
      const minutesVal = Math.floor(absDiffMs / (60 * 1000));
      text = `Quá hạn ${minutesVal === 0 ? 1 : minutesVal} phút`;
    } else if (absDiffMs < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(absDiffMs / (60 * 60 * 1000));
      text = `Quá hạn ${hours} giờ`;
    } else {
      const days = Math.floor(absDiffMs / (24 * 60 * 60 * 1000));
      text = `Quá hạn ${days} ngày`;
    }
    badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium';
  } else {
    // Remaining
    if (diffMs < 24 * 60 * 60 * 1000) {
      // Less than 24 hours
      const diffMinutes = Math.floor(diffMs / (60 * 1000));
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      const padHours = hours.toString().padStart(2, '0');
      const padMinutes = minutes.toString().padStart(2, '0');
      text = hours > 0 ? `${padHours} giờ ${padMinutes} phút` : `${minutes} phút`;
      badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse font-medium';
    } else {
      // 1 day or more
      const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      text = `Còn ${days} ngày`;
      badgeColor = days <= 7
        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium'
        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium';
    }
  }

  return (
    <span className={`inline-flex items-center justify-center whitespace-nowrap text-xs font-semibold px-2.5 py-0.5 rounded ${badgeColor}`}>
      {text}
    </span>
  );
}

export default CountdownBadge;
