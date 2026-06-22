import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeContext";
import Script from "next/script";

export const metadata: Metadata = {
  title: "BanHangMMO - Hệ thống Quản lý Tài khoản Dịch vụ Số",
  description: "Hệ thống quản lý và bán tài khoản dịch vụ số chuyên nghiệp: Canva Pro, ChatGPT Plus, Netflix, Spotify, YouTube Premium. Dành cho chủ shop MMO, đại lý, CTV tại Việt Nam.",
  keywords: "tài khoản dịch vụ số, Canva Pro, ChatGPT Plus, Netflix, Spotify, YouTube Premium, quản lý tài khoản, bán tài khoản MMO, đại lý tài khoản",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head />
      <body>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('app-theme') || 'system';
                  let resolved = saved;
                  if (saved === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.remove('light', 'dark');
                  document.documentElement.classList.add(resolved);
                } catch (e) {}
              })();
            `,
          }}
        />
        <AuthProvider>
          <ThemeProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: 'var(--bg-card)',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: 'var(--bg-card)',
                  },
                },
              }}
            />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
