'use client';

import { useState, useEffect } from 'react';

interface CountdownBadgeProps {
  endDate: string | Date;
  status: string;
  completedAt?: string | Date;
}

export function CountdownBadge({ endDate, status, completedAt }: CountdownBadgeProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000); // update every minute
    return () => clearInterval(timer);
  }, []);

  const formatDateOnly = (dateInput?: string | Date | null) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (dateInput?: string | Date | null) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const end = new Date(endDate);
  const diffMs = end.getTime() - now.getTime();

  let badgeText = '';
  let badgeColor = '';
  let subtext = '';

  const isWarranty = ['REPORTED', 'WARRANTY', 'WAIT_SOURCE', 'WARRANTY_PENDING_SOURCE', 'WAIT_CUSTOMER_REFUND', 'WARRANTY_PENDING_REFUND', 'SOURCE_REJECTED', 'WARRANTY_REJECTED'].includes(status);
  const isCompleted = ['COMPLETED', 'WARRANTY_DONE', 'REFUNDED'].includes(status);

  if (isCompleted) {
    badgeText = 'Hoàn tất';
    badgeColor = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    subtext = `Hoàn tất: ${formatDateOnly(completedAt)}`;
  } else if (isWarranty) {
    badgeText = status === 'SOURCE_REJECTED' || status === 'WARRANTY_REJECTED' ? 'Từ chối hoàn' : 'Có sự cố';
    badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold';
    subtext = `Báo lỗi: ${formatDateTime(completedAt)}`;
  } else {
    // Normal active / expiring / overdue states
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    subtext = `Hạn: ${formatDateOnly(endDate)}`;

    if (status === 'EXPIRING' || status === 'EXPIRING_SOON') {
      badgeText = `Còn ${days > 0 ? days : 0} ngày`;
      badgeColor = 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium animate-pulse';
    } else if (diffMs < 0) {
      const absDiffMs = Math.abs(diffMs);
      const overdueDays = Math.floor(absDiffMs / (24 * 60 * 60 * 1000));
      badgeText = overdueDays === 0 ? 'Quá hạn hôm nay' : `Quá hạn ${overdueDays} ngày`;
      badgeColor = 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium';
    } else {
      badgeText = `Còn ${days} ngày`;
      badgeColor = days <= 7
        ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium'
        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium';
    }
  }

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className={`status-badge border ${badgeColor}`}>
        {badgeText}
      </span>
      <span className="text-[10px] text-slate-500 font-mono leading-tight whitespace-pre-line text-left block">
        {subtext}
      </span>
    </div>
  );
}

export default CountdownBadge;
