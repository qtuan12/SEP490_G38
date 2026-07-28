import React, { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { systemConfigService } from '../services/systemConfigService';

const DEFAULT_COMPANY_NAME = 'BPG CMS';
const DEFAULT_LOGO_URL = '/logo.png';

interface CompanyContextType {
  companyName: string;
  companyLogoUrl: string;
  refetch: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, refetch } = useQuery({
    queryKey: ['company-info'],
    queryFn: () => systemConfigService.getCompanyInfo(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const value: CompanyContextType = {
    companyName: data?.companyName || DEFAULT_COMPANY_NAME,
    companyLogoUrl: data?.companyLogoUrl || DEFAULT_LOGO_URL,
    refetch: () => refetch(),
  };

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = (): CompanyContextType => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider');
  return ctx;
};

export const useInvalidateCompanyInfo = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['company-info'] });
};
