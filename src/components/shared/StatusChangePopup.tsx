'use client';

import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export interface StatusOption {
  value: string;
  label: string;
}

interface StatusChangePopupProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  currentStatus: string;
  allowedStatuses: StatusOption[];
  onSubmit: (data: {
    status: string;
    note: string;
    notifyCustomer: boolean;
    saveHistory: boolean;
  }) => Promise<void>;
}

export default function StatusChangePopup({
  isOpen,
  onClose,
  title = 'Cập nhật trạng thái',
  currentStatus,
  allowedStatuses,
  onSubmit,
}: StatusChangePopupProps) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);
  const [saveHistory, setSaveHistory] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ status, note, notifyCustomer, saveHistory });
      setNote('');
      onClose();
    } catch (err) {
      // Errors should be handled by the parent submit handler
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-[#131722] border border-white/10 shadow-2xl text-white text-xs">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-all focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-base font-bold text-white mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Chọn trạng thái *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#1a1f2e] border border-white/10 text-white text-sm focus:outline-none"
            >
              {allowedStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold uppercase">Ghi chú nội bộ (không bắt buộc)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú lý do thay đổi trạng thái..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none resize-none text-sm"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={(e) => setNotifyCustomer(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">🔔 Gửi thông báo cho khách hàng</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveHistory}
                onChange={(e) => setSaveHistory(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 bg-[#131722] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-300 font-medium">📝 Lưu lịch sử hoạt động (Activity Log)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-400 border border-white/5 hover:bg-white/5 transition-all focus:outline-none"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 cursor-pointer focus:outline-none"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
