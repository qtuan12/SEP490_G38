import React, { createContext, useContext, useState, useCallback } from 'react';
import { BPGLoadingOverlay } from '../components/ui/BPGLoadingOverlay';

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string | undefined;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCount, setActiveCount] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>(undefined);

  const showLoading = useCallback((message?: string) => {
    setActiveCount((prev) => prev + 1);
    if (message) setLoadingMessage(message);
  }, []);

  const hideLoading = useCallback(() => {
    setActiveCount((prev) => {
      const next = Math.max(0, prev - 1);
      if (next === 0) setLoadingMessage(undefined);
      return next;
    });
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, message?: string): Promise<T> => {
      showLoading(message);
      try {
        return await fn();
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading]
  );

  const isLoading = activeCount > 0;

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, showLoading, hideLoading, withLoading }}>
      {children}
      {isLoading && <BPGLoadingOverlay message={loadingMessage} fullScreen backdrop />}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
