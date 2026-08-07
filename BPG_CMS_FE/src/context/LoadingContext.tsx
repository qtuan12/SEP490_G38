import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FullScreenLoading } from '../components/ui/FullScreenLoading';

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const GLOBAL_SHOW_LOADING_EVENT = 'bpg_show_global_loading';
export const GLOBAL_HIDE_LOADING_EVENT = 'bpg_hide_global_loading';

export const triggerGlobalLoading = (message?: string) => {
  window.dispatchEvent(new CustomEvent(GLOBAL_SHOW_LOADING_EVENT, { detail: { message } }));
};

export const triggerGlobalHideLoading = () => {
  window.dispatchEvent(new CustomEvent(GLOBAL_HIDE_LOADING_EVENT));
};

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Hệ thống đang xử lý dữ liệu...');

  const showLoading = useCallback((message?: string) => {
    if (message) setLoadingMessage(message);
    setIsLoading(true);
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleShow = (e: any) => {
      const msg = e.detail?.message || 'Hệ thống đang xử lý dữ liệu...';
      setLoadingMessage(msg);
      setIsLoading(true);
    };

    const handleHide = () => {
      setIsLoading(false);
    };

    window.addEventListener(GLOBAL_SHOW_LOADING_EVENT, handleShow);
    window.addEventListener(GLOBAL_HIDE_LOADING_EVENT, handleHide);

    return () => {
      window.removeEventListener(GLOBAL_SHOW_LOADING_EVENT, handleShow);
      window.removeEventListener(GLOBAL_HIDE_LOADING_EVENT, handleHide);
    };
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, loadingMessage, showLoading, hideLoading }}>
      {children}
      <FullScreenLoading isOpen={isLoading} message={loadingMessage} />
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
