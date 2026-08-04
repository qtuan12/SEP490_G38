import React from 'react';
import { useCompany } from '../../context/CompanyContext';

interface FullScreenLoadingProps {
  isOpen?: boolean;
  message?: string;
}

export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  isOpen = true,
}) => {
  const { companyName, companyLogoUrl } = useCompany();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm animate-fade-in select-none"
      style={{ isolation: 'isolate' }}
    >
      <div className="relative flex flex-col items-center justify-center p-6 text-center">
        {/* Outer spinning ring */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-blue-600 border-r-blue-500 animate-spin" style={{ borderWidth: '3px' }} />
          
          {/* Inner Logo Circle */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white p-3 flex items-center justify-center shadow-lg border border-slate-100 z-10">
            <img
              src={companyLogoUrl}
              alt={companyName}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.png';
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
