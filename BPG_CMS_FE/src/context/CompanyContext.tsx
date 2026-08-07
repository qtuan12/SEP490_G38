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

  const companyName = data?.companyName || DEFAULT_COMPANY_NAME;
  const companyLogoUrl = data?.companyLogoUrl || DEFAULT_LOGO_URL;

  React.useEffect(() => {
    if (companyName) {
      document.title = `${companyName} - Hệ Thống Quản Lý Thi Công Xây Dựng`;
    }
  }, [companyName]);

  const value: CompanyContextType = {
    companyName,
    companyLogoUrl,
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
