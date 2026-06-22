'use client';

import { useState } from 'react';
import { Settings, Save, Store, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminSettingsPage() {
  const [shopName, setShopName] = useState('BanHangMMO');
  const [shopDescription, setShopDescription] = useState('Hệ thống CRM quản lý nội bộ - Bán tài khoản và dịch vụ số');
  const [savingSettings, setSavingSettings] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    // In a real app, this would save to database
    setTimeout(() => {
      setSavingSettings(false);
      toast.success('Đã lưu cấu hình CRM thành công!');
    }, 500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        toast.success('Đổi mật khẩu thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Đổi mật khẩu thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl text-white">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-indigo-400" />
          ⚙️ Cài đặt hệ thống
        </h1>
        <p className="text-sm text-slate-400 mt-1">Thiết lập thông tin vận hành CRM nội bộ và quản trị tài khoản quản lý.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: CRM Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
              <Store className="w-5 h-5 text-indigo-400" />
              Cấu hình thông tin CRM
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Tên hệ thống</label>
                <input 
                  type="text" 
                  value={shopName} 
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none transition-colors" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Mô tả hệ thống</label>
                <textarea 
                  value={shopDescription} 
                  onChange={(e) => setShopDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none resize-none transition-colors" 
                />
              </div>
            </div>
            
            <div className="flex justify-end pt-3">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>

        {/* Right column: Password modification */}
        <div className="p-6 rounded-2xl bg-[#1a1f2e]/50 border border-white/5 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2">
            <KeyRound className="w-5 h-5 text-amber-400" />
            Đổi mật khẩu tài khoản
          </h2>
          
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Mật khẩu hiện tại</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Mật khẩu mới</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Từ 6 ký tự trở lên"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Nhập lại mật khẩu mới"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:border-indigo-500 focus:outline-none" 
              />
            </div>
            
            <button
              type="submit"
              disabled={changingPassword}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
            >
              {changingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận đổi mật khẩu
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
