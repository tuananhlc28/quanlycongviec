'use client';

import { getStatusColor, getStatusLabel } from '@/lib/utils';

interface StatusBadgeProps {
  status?: string;
  remainingDays?: number;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, remainingDays, label, className = '' }: StatusBadgeProps) {
  // If remainingDays is provided, format subscription-specific badges
  if (remainingDays !== undefined) {
    let colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; // Active
    let text = `Còn ${remainingDays} ngày`;

    if (status === 'LOCKED') {
      colorClass = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
      text = 'Đã khóa';
    } else if (remainingDays <= 0) {
      colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
      text = 'Hết hạn';
    } else if (remainingDays === 1) {
      colorClass = 'text-red-400 bg-red-500/10 border-red-500/20';
      text = 'Hết hạn hôm nay';
    } else if (remainingDays < 7) {
      colorClass = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      text = `Còn ${remainingDays} ngày (Hết hạn gấp)`;
    } else if (remainingDays < 30) {
      colorClass = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {text}
      </span>
    );
  }

  // Fallback to general status mapping from utils
  if (status) {
    const colorClass = getStatusColor(status);
    const text = label || getStatusLabel(status);

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClass} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {text}
      </span>
    );
  }

  return null;
}
