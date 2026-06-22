'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session, update: updateSession } = useSession();
  const [theme, setThemeState] = useState<Theme>('system');

  // Initialize theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  // Sync theme from session when user logs in
  useEffect(() => {
    if (session?.user && (session.user as any).theme) {
      const userTheme = (session.user as any).theme.toLowerCase() as Theme;
      if (userTheme && userTheme !== theme) {
        setThemeState(userTheme);
        localStorage.setItem('app-theme', userTheme);
      }
    }
  }, [session]);

  // Apply theme class to document
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');

      let resolvedTheme = theme;
      if (theme === 'system') {
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = systemIsDark ? 'dark' : 'light';
      }

      root.classList.add(resolvedTheme);
    };

    applyTheme();

    // Listen for system changes if system theme is selected
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme]);

  // Update theme state, localstorage, and database
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);

    // If logged in, save to database
    if (session?.user) {
      try {
        const res = await fetch('/api/account/theme', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: newTheme.toUpperCase() }),
        });
        
        if (res.ok) {
          // Update local session payload
          await updateSession({
            ...session,
            user: {
              ...session.user,
              theme: newTheme.toUpperCase(),
            }
          });
        }
      } catch (error) {
        console.error('Failed to sync theme to DB:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
