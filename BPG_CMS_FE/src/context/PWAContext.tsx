import React, { createContext, useContext, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { isPWAMode, isPWAOptimizedRole, isPWAAllowedFieldRoute } from '../utils/pwaHelpers';

interface PWAContextValue {
  /** Đang chạy ở chế độ PWA (standalone hoặc ?standalone=true). */
  isPWA: boolean;
  /** Chức vụ nằm trong nhóm mà giao diện PWA được thiết kế cho (Nhân viên kỹ thuật / project leader). */
  isOptimizedRole: boolean;
  /**
   * PWA nhưng chức vụ không phù hợp: chỉ được ở lại trang Cá nhân,
   * mọi màn hình khác đều bị đưa về đó kèm cảnh báo.
   */
  shouldBlock: boolean;
  /**
   * Đúng chức vụ nhưng màn hình hiện tại chưa được tối ưu cho di động
   * (phiếu kho, đơn mua hàng, nghiệm thu, báo cáo... mở từ thông báo).
   */
  isUnsupportedScreen: boolean;
}

const PWAContext = createContext<PWAContextValue | undefined>(undefined);

export const PWAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  const value = useMemo<PWAContextValue>(() => {
    const isPWA = isPWAMode();
    const isOptimizedRole = isPWAOptimizedRole(user?.role);
    return {
      isPWA,
      isOptimizedRole,
      shouldBlock: isPWA && !!user && !isOptimizedRole,
      isUnsupportedScreen:
        isPWA && !!user && isOptimizedRole
        && !isPWAAllowedFieldRoute(location.pathname, location.search),
    };
  }, [user, location.pathname, location.search]);

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
};

export const usePWA = (): PWAContextValue => {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA phải được dùng bên trong PWAProvider');
  return ctx;
};
