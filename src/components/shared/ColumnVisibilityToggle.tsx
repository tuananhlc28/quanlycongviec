import React, { useEffect, useState } from 'react';
import { Columns, RotateCcw } from 'lucide-react';

interface ColumnConfig {
  id: string; // unique identifier for column
  label: string; // display name
}

interface Props {
  columns: ColumnConfig[];
  visibleColumns: string[]; // array of column ids that are visible
  onToggle: (colId: string) => void;
  storageKey: string; // localStorage key for persistence
}

/**
 * Dropdown component to toggle column visibility.
 * Persists the visibility settings in localStorage.
 * Includes a Reset button to restore default (all columns visible).
 */
const ColumnVisibilityToggle: React.FC<Props> = ({ columns, visibleColumns, onToggle, storageKey }) => {
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    // Show all columns
    const allIds = columns.map((c) => c.id);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
    // Trigger parent toggle for each hidden column
    columns.forEach((col) => {
      if (!visibleColumns.includes(col.id)) {
        onToggle(col.id);
      }
    });
  };

  useEffect(() => {
    // close dropdown on outside click
    const listener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.col-visibility-toggle')) {
        setOpen(false);
      }
    };
    document.addEventListener('click', listener);
    return () => document.removeEventListener('click', listener);
  }, []);

  return (
    <div className="relative col-visibility-toggle inline-block">
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 bg-[#131722] hover:bg-white/5 rounded-xl border border-white/10 transition-all cursor-pointer focus:outline-none"
        onClick={() => setOpen(!open)}
      >
        <Columns className="w-3.5 h-3.5" />
        <span>Cột hiển thị</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-56 bg-[#131722] border border-white/10 rounded-xl shadow-2xl z-50 p-2 text-white">
          <div className="px-2 py-1.5 border-b border-white/5 mb-1.5">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Ẩn/hiển thị cột</p>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {columns.map((col) => (
              <label key={col.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs text-slate-300 hover:text-white cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={() => onToggle(col.id)}
                  className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                />
                <span>{col.label}</span>
              </label>
            ))}
          </div>
          <hr className="my-1.5 border-white/5" />
          <button
            type="button"
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer"
            onClick={handleReset}
          >
            <RotateCcw className="w-3 h-3" />
            Đặt lại mặc định
          </button>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityToggle;
