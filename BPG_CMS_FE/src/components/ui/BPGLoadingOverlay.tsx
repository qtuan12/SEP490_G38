import React from 'react';

export interface BPGLoadingOverlayProps {
  isLoading?: boolean;
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
  backdrop?: boolean;
  className?: string;
}

export const BPGLoadingOverlay: React.FC<BPGLoadingOverlayProps> = ({
  isLoading = true,
  message = 'Đang xử lý, vui lòng chờ...',
  submessage = 'Hệ thống Quản lý BPG',
  fullScreen = true,
  backdrop = true,
  className = '',
}) => {
  if (!isLoading) return null;

  const containerClasses = fullScreen
    ? `fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 transition-all duration-300 ${
        backdrop ? 'bg-slate-900/40 backdrop-blur-[3px]' : ''
      } ${className}`
    : `relative flex flex-col items-center justify-center p-6 w-full ${className}`;

  return (
    <div className={containerClasses}>
      <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center animate-fade-in">
        {/* Animated BPG Logo Box */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 border-r-blue-500 animate-spin" />
          {/* Outer glowing pulse ring */}
          <div className="absolute inset-1.5 rounded-full bg-blue-500/10 animate-ping pointer-events-none" />
          {/* BPG Logo image */}
          <img
            src="/logo.png"
            alt="BPG Loading..."
            className="w-12 h-12 object-contain animate-pulse z-10 select-none"
            onError={(e) => {
              // Fallback to svg icon if PNG path fails
              (e.target as HTMLImageElement).src = '/favicon.svg';
            }}
          />
        </div>

        {/* Text messaging */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tracking-wide animate-pulse">
            {message}
          </p>
          {submessage && (
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              {submessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
