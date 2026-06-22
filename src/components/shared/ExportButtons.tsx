'use client';

import { exportToCSV } from '@/lib/utils';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface ExportButtonsProps {
  data: Record<string, any>[];
  filename: string;
  headers?: Record<string, string>;
  label?: string;
  className?: string;
}

export default function ExportButtons({
  data,
  filename,
  headers,
  label = 'Xuất dữ liệu',
  className = '',
}: ExportButtonsProps) {
  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error('Không có dữ liệu để xuất!');
      return;
    }

    try {
      exportToCSV(data, filename, headers);
      toast.success(`Đã xuất ${data.length} dòng dữ liệu sang CSV!`);
    } catch {
      toast.error('Lỗi khi xuất dữ liệu!');
    }
  };

  return (
    <button
      onClick={handleExport}
      type="button"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all ${className}`}
      title="Tải xuống tệp CSV hỗ trợ hiển thị tiếng Việt (UTF-8 BOM)"
    >
      <Download className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
