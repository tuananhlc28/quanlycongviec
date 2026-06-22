'use client';

import Image from 'next/image';

interface ServiceLogoProps {
  logo?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7 text-sm rounded-lg',
  md: 'w-10 h-10 text-lg rounded-xl',
  lg: 'w-14 h-14 text-2xl rounded-2xl',
  xl: 'w-20 h-20 text-4xl rounded-3xl',
};

const emojiBgGradients = [
  'from-pink-500/20 to-rose-500/20 text-rose-400 border-rose-500/20',
  'from-purple-500/20 to-indigo-500/20 text-indigo-400 border-indigo-500/20',
  'from-blue-500/20 to-sky-500/20 text-sky-400 border-sky-500/20',
  'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20',
  'from-amber-500/20 to-orange-500/20 text-amber-400 border-orange-500/20',
];

function getHashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default function ServiceLogo({ logo, name, size = 'md', className = '' }: ServiceLogoProps) {
  const sizeClass = sizeClasses[size];
  const hash = getHashString(name);
  const bgGradient = emojiBgGradients[hash % emojiBgGradients.length];

  // Helper to check if string is a URL
  const isUrl = logo && (logo.startsWith('http://') || logo.startsWith('https://') || logo.startsWith('/'));

  if (isUrl) {
    return (
      <div className={`relative flex items-center justify-center bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 ${sizeClass} ${className}`}>
        <Image
          src={logo}
          alt={name}
          width={100}
          height={100}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback to emoji or first letter
  const displayChar = logo && logo.trim() ? logo.trim() : name.charAt(0).toUpperCase();
  
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br border font-bold flex-shrink-0 ${bgGradient} ${sizeClass} ${className}`}>
      {displayChar}
    </div>
  );
}
