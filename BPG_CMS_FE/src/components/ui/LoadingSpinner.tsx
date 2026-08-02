import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { FullScreenLoading } from './FullScreenLoading';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  className = '',
  label
}) => {
  const { companyName, companyLogoUrl } = useCompany();

  if (fullScreen) {
    return <FullScreenLoading message={label || 'Đang tải dữ liệu...'} />;
  }

  // Size mapping for container and logo
  const sizeConfig = {
    sm: {
      outer: 'w-6 h-6',
      inner: 'w-5 h-5 p-0.5',
      text: 'text-xs',
    },
    md: {
      outer: 'w-10 h-10',
      inner: 'w-8 h-8 p-1',
      text: 'text-xs sm:text-sm',
    },
    lg: {
      outer: 'w-14 h-14',
      inner: 'w-11 h-11 p-1.5',
      text: 'text-sm font-medium',
    },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  return (
    <div className={`flex flex-col items-center justify-center p-4 gap-2.5 select-none ${className}`}>
      <div className={`relative flex items-center justify-center ${currentSize.outer}`}>
        {/* Outer animated spinning gradient ring */}
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 border-r-indigo-500 border-b-cyan-400 animate-spin-slow shadow-md" />
        
        {/* Inner white circle with Company Logo */}
        <div className={`rounded-full bg-white flex items-center justify-center shadow-md animate-pulse-logo z-10 ${currentSize.inner}`}>
          <img
            src={companyLogoUrl}
            alt={companyName}
            className="w-full h-full object-contain filter drop-shadow-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.png';
            }}
          />
        </div>
      </div>

      {label && (
        <span className={`text-[hsl(var(--text-secondary))] animate-pulse text-center ${currentSize.text}`}>
          {label}
        </span>
      )}
    </div>
  );
};
