import React from 'react';
import { BPGLoadingOverlay } from './BPGLoadingOverlay';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  fullScreen = false,
  message,
  className = '',
}) => {
  if (fullScreen) {
    return <BPGLoadingOverlay message={message} fullScreen backdrop />;
  }

  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinner = (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg className={`animate-spin text-blue-600 ${sizes[size]}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {message && <span className="text-sm font-medium text-slate-600">{message}</span>}
    </div>
  );

  return <div className="flex justify-center items-center p-4">{spinner}</div>;
};

