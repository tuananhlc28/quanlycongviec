'use client';

import { useState } from 'react';
import { useTheme } from '@/components/providers/ThemeContext';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const getThemeIcon = (t: string) => {
    switch (t) {
      case 'light':
        return <Sun className="w-4 h-4 text-amber-500" />;
      case 'dark':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      default:
        return <Monitor className="w-4 h-4 text-slate-400" />;
    }
  };

  const getThemeLabel = (t: string) => {
    switch (t) {
      case 'light':
        return 'Sáng';
      case 'dark':
        return 'Tối';
      default:
        return 'Hệ thống';
    }
  };

  const handleSelect = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all text-xs font-semibold select-none cursor-pointer"
        title="Đổi giao diện"
      >
        {getThemeIcon(theme)}
        <span>{getThemeLabel(theme)}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <ul className="absolute right-0 top-full mt-2 w-36 py-1.5 rounded-xl bg-[#131722] border border-white/10 shadow-2xl z-50 text-xs text-slate-300 animate-fade-in font-medium overflow-hidden">
            <li>
              <button
                onClick={() => handleSelect('light')}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-white/5 hover:text-white text-left transition-colors ${
                  theme === 'light' ? 'text-amber-400 font-bold bg-white/3' : ''
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>☀️ Sáng</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handleSelect('dark')}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-white/5 hover:text-white text-left transition-colors ${
                  theme === 'dark' ? 'text-indigo-400 font-bold bg-white/3' : ''
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>🌙 Tối</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => handleSelect('system')}
                className={`flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-white/5 hover:text-white text-left transition-colors ${
                  theme === 'system' ? 'text-slate-400 font-bold bg-white/3' : ''
                }`}
              >
                <Monitor className="w-4 h-4 text-slate-400" />
                <span>🖥️ Hệ thống</span>
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
