'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ActionBarAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'danger' | 'primary' | 'secondary' | 'warning' | 'purple' | 'success';
  disabled?: boolean;
}

interface StickyBottomActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: ActionBarAction[];
}

export function StickyBottomActionBar({
  selectedCount,
  onClearSelection,
  actions,
}: StickyBottomActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4 animate-slide-up">
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-slate-900/95 border border-slate-800 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.15)] h-12">
        {/* Count and Clear Selection */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-200 ml-1">
            Đã chọn <strong className="text-indigo-400 font-mono">{selectedCount}</strong>
          </span>
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Bỏ chọn
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 pr-1">
          {actions.map((act, idx) => {
            let btnClass = 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white';
            
            if (act.variant === 'danger') {
              btnClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500 hover:text-white';
            } else if (act.variant === 'primary') {
              btnClass = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white';
            } else if (act.variant === 'success') {
              btnClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white';
            } else if (act.variant === 'warning') {
              btnClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500 hover:text-white';
            } else if (act.variant === 'purple') {
              btnClass = 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500 hover:text-white';
            }

            return (
              <button
                key={idx}
                onClick={act.onClick}
                disabled={act.disabled}
                className={`flex items-center justify-center gap-1.5 px-3.5 h-[30px] text-xs font-semibold rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${btnClass}`}
              >
                {act.icon}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StickyBottomActionBar;
