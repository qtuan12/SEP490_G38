import React from 'react';
import { useCompany } from '../../context/CompanyContext';

interface FullScreenLoadingProps {
  isOpen?: boolean;
  message?: string;
}

export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  isOpen = true,
  message = 'Hệ thống đang xử lý dữ liệu...'
}) => {
  const { companyName, companyLogoUrl } = useCompany();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md animate-fade-in select-none"
      style={{ isolation: 'isolate' }}
    >
      <div className="relative flex flex-col items-center justify-center p-6 text-center">
        {/* Outer spinning gradient ring */}
        <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-r-indigo-500 border-b-cyan-400 animate-spin-slow shadow-lg opacity-90" />
          <div className="absolute -inset-2 rounded-full border border-blue-500/20 animate-ping opacity-30" />
          
          {/* Inner Logo Circle with Glow */}
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white p-3 flex items-center justify-center shadow-2xl animate-pulse-logo z-10">
            <img
              src={companyLogoUrl}
              alt={companyName}
              className="w-full h-full object-contain filter drop-shadow-md"
              onError={(e) => {
                // Fallback if logo URL fails
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
        </div>

        {/* Company Name */}
        <h3 className="mt-5 text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-sm">
          {companyName}
        </h3>

        {/* Loading message */}
        <p className="mt-2 text-xs sm:text-sm font-medium text-slate-300 max-w-xs sm:max-w-md leading-relaxed">
          {message}
        </p>

        {/* Animated shimmer progress bar */}
        <div className="mt-4 w-44 sm:w-56 h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative border border-slate-700/50 shadow-inner">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 w-full h-full animate-shimmer" />
        </div>
      </div>
    </div>
  );
};
