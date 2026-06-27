'use client';

import React, { useState, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface ServiceAccountCellProps {
  email: string | null;
  password?: string | null;
}

export default function ServiceAccountCell({ email, password }: ServiceAccountCellProps) {
  const [showPassword, setShowPassword] = useState(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!email) {
    return <span className="text-slate-600">—</span>;
  }

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    toast.success('Đã sao chép tài khoản');
  };

  const handleCopyAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const copyText = password ? `${email}|${password}` : email;
    navigator.clipboard.writeText(copyText);
    toast.success('Đã sao chép tài khoản và mật khẩu');
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    const copyText = password ? `${email}|${password}` : email;
    navigator.clipboard.writeText(copyText);
    toast.success('Đã sao chép tài khoản | mật khẩu');
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      const copyText = password ? `${email}|${password}` : email;
      navigator.clipboard.writeText(copyText);
      toast.success('Đã sao chép tài khoản | mật khẩu');
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null;
        navigator.clipboard.writeText(email);
        toast.success('Đã sao chép tài khoản');
      }, 250);
    }
  };

  return (
    <div 
      className="space-y-1 text-xs max-w-[200px]"
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span 
          onClick={handleClick}
          className="font-semibold text-indigo-400 hover:text-indigo-350 hover:underline truncate cursor-pointer select-all font-mono"
          title="Click 1 lần copy tài khoản, click đúp copy cả tài khoản và mật khẩu"
        >
          {email}
        </span>
        {password && (
          <>
            <span className="font-mono text-slate-300">
              {showPassword ? password : '••••••••'}
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowPassword(!showPassword);
              }}
              className="text-slate-500 hover:text-slate-300 cursor-pointer focus:outline-none"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={handleCopyEmail}
          className="text-[9px] text-indigo-400 hover:text-indigo-350 bg-indigo-500/5 hover:bg-indigo-500/10 px-1 py-0.5 rounded border border-indigo-500/10 focus:outline-none cursor-pointer"
        >
          Copy TK
        </button>
        {password && (
          <button
            onClick={handleCopyAll}
            className="text-[9px] text-emerald-400 hover:text-emerald-350 bg-emerald-500/5 hover:bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/10 focus:outline-none cursor-pointer"
          >
            Copy TK + MK
          </button>
        )}
      </div>
    </div>
  );
}
