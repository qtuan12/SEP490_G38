import React from 'react';
import { Loader2 } from 'lucide-react';
import { FullScreenLoading } from './FullScreenLoading';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
  className?: string;
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  className = '',
  label
}) => {
  if (fullScreen) {
    return <FullScreenLoading message={label || 'Đang tải dữ liệu...'} />;
  }

  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-2 p-4 select-none ${className}`}>
      <Loader2 className={`animate-spin text-[hsl(var(--primary))] ${sizeMap[size] || sizeMap.md}`} />
      {label && (
        <span className="text-sm font-medium text-[hsl(var(--text-muted))] animate-pulse text-center">
          {label}
        </span>
      )}
    </div>
  );
};

