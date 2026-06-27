'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X } from 'lucide-react';

export type TimeRange =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'thisYear'
  | 'custom'
  | 'all';

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface TimeFilterDropdownProps {
  value: TimeRange;
  onChange: (range: TimeRange, dates: DateRange | null) => void;
  customStart?: string;
  customEnd?: string;
  onCustomChange?: (start: string, end: string) => void;
  size?: 'sm' | 'md';
}

const PRESETS: { value: TimeRange; label: string; icon: string }[] = [
  { value: 'all', label: 'Tất cả thời gian', icon: '🌐' },
  { value: 'today', label: 'Hôm nay', icon: '📅' },
  { value: 'yesterday', label: 'Hôm qua', icon: '⬅️' },
  { value: '7days', label: '7 ngày gần đây', icon: '📆' },
  { value: '30days', label: '30 ngày gần đây', icon: '🗓️' },
  { value: 'thisMonth', label: 'Tháng này', icon: '📅' },
  { value: 'lastMonth', label: 'Tháng trước', icon: '⏮️' },
  { value: 'thisQuarter', label: 'Quý này', icon: '📊' },
  { value: 'thisYear', label: 'Năm nay', icon: '🗓️' },
  { value: 'custom', label: 'Tùy chỉnh', icon: '✏️' },
];

export function computeDateRange(range: TimeRange): DateRange | null {
  if (range === 'all' || range === 'custom') return null;
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  switch (range) {
    case 'today': {
      const s = fmt(now);
      return { start: s, end: s };
    }
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const s = fmt(y);
      return { start: s, end: s };
    }
    case '7days': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: fmt(s), end: fmt(now) };
    }
    case '30days': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { start: fmt(s), end: fmt(now) };
    }
    case 'thisMonth': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(s), end: fmt(now) };
    }
    case 'lastMonth': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(s), end: fmt(e) };
    }
    case 'thisQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      const s = new Date(now.getFullYear(), q * 3, 1);
      return { start: fmt(s), end: fmt(now) };
    }
    case 'thisYear': {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: fmt(s), end: fmt(now) };
    }
    default:
      return null;
  }
}

export default function TimeFilterDropdown({
  value,
  onChange,
  customStart = '',
  customEnd = '',
  onCustomChange,
  size = 'md',
}: TimeFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedPreset = PRESETS.find(p => p.value === value);
  const isActive = value !== 'all';

  const handleSelect = (range: TimeRange) => {
    const dates = computeDateRange(range);
    onChange(range, dates);
    if (range !== 'custom') setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('all', null);
    setOpen(false);
  };

  const btnClass = size === 'sm'
    ? 'px-2.5 py-1.5 text-[11px]'
    : 'px-3 py-2 text-xs';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 ${btnClass} rounded-xl font-semibold transition-all cursor-pointer border ${
          isActive
            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/8'
        }`}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="whitespace-nowrap">
          {value === 'custom' && customStart
            ? `${customStart} → ${customEnd || '...'}`
            : selectedPreset?.label || 'Thời gian'}
        </span>
        {isActive ? (
          <X className="w-3 h-3 ml-0.5 hover:text-white cursor-pointer flex-shrink-0" onClick={handleClear} />
        ) : (
          <ChevronDown className={`w-3 h-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-56 py-1.5 rounded-xl bg-[#131722] border border-white/10 shadow-2xl shadow-black/40 animate-fade-in">
          <div className="px-3 py-1.5 border-b border-white/5 mb-1">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Lọc theo thời gian</p>
          </div>
          {PRESETS.map(preset => (
            <button
              key={preset.value}
              onClick={() => handleSelect(preset.value)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all cursor-pointer ${
                value === preset.value
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-sm leading-none">{preset.icon}</span>
              <span>{preset.label}</span>
              {value === preset.value && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}

          {value === 'custom' && (
            <div className="px-3 pt-2 pb-1.5 border-t border-white/5 mt-1 space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Khoảng ngày tùy chỉnh</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => onCustomChange?.(e.target.value, customEnd)}
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-slate-500 text-[10px]">→</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => onCustomChange?.(customStart, e.target.value)}
                  className="flex-1 px-2 py-1.5 text-[10px] rounded-lg bg-white/5 border border-white/10 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-full py-1.5 text-[10px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all cursor-pointer"
              >
                Áp dụng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
