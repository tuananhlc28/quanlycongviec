'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Key, Mail, Lock, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Email hoặc mật khẩu không đúng');
      } else {
        toast.success('Đăng nhập thành công!');
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error('Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-3 group">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl group-hover:shadow-indigo-500/30 transition-shadow">
            <Key className="w-6 h-6 text-white" />
          </div>
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">BanHangMMO CRM</h1>
        <p className="text-sm text-slate-400 mt-1">Hệ thống Quản lý Nội bộ</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-8 rounded-2xl glass-strong space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="your@email.com"
               required
               className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input
               type={showPassword ? 'text' : 'password'}
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               placeholder="••••••••"
               required
               className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:border-indigo-500 transition-all"
            />
            <button
               type="button"
               onClick={() => setShowPassword(!showPassword)}
               className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            >
               {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              Đăng nhập
            </>
          )}
        </button>

        {/* Demo accounts */}
        <div className="pt-4 border-t border-white/5">
          <p className="text-xs text-slate-500 mb-3 text-center">Tài khoản truy cập</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { email: 'admin@mmo.vn', password: 'admin123', label: 'Quản trị viên', color: 'text-cyan-400' },
              { email: 'staff@mmo.vn', password: 'staff123', label: 'Nhân viên', color: 'text-purple-400' },
            ].map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 hover:bg-white/5 border border-white/5 text-xs transition-all"
              >
                <span className={`font-medium ${account.color}`}>{account.label}</span>
                <span className="text-slate-500">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8 rounded-2xl glass-strong min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
