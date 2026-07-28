import React from 'react';
import { Navigate } from 'react-router-dom';
import { isPWAMode } from '../utils/pwaHelpers';
import { Monitor, Smartphone } from 'lucide-react';
import { Button } from './ui';

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
  fallbackToField?: boolean;
}

export const DesktopOnlyGuard: React.FC<DesktopOnlyGuardProps> = ({ children, fallbackToField = false }) => {
  if (isPWAMode()) {
    if (fallbackToField) {
      return <Navigate to="/field?standalone=true" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 text-slate-800">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Monitor size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Màn hình tối ưu cho Máy tính</h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Màn hình này yêu cầu giao diện trình duyệt máy tính màn hình lớn để hiển thị đầy đủ thông tin. Bạn đang sử dụng ứng dụng **PWA Field Mode**, vui lòng chuyển về Bàn làm việc công trường.
          </p>
          <Button
            variant="primary"
            onClick={() => window.location.href = '/field?standalone=true'}
            className="w-full flex items-center justify-center gap-2 py-2.5"
          >
            <Smartphone size={18} />
            <span>Quay lại Bàn làm việc công trường</span>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
