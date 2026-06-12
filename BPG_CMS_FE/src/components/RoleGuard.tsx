import React from 'react';
import { useAuth } from '../context/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode; // Giao diện phụ khi không có quyền (mặc định ẩn hoàn toàn)
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children, fallback = null }) => {
  const { user, isAuthenticated } = useAuth();

  // 1. Chưa đăng nhập thì hiển thị giao diện phụ
  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }

  // 2. Chuyển role của user và danh sách allowedRoles về chữ thường để so sánh không phân biệt hoa thường
  const userRoleLower = user.role.toLowerCase();
  const hasAccess = allowedRoles.map(r => r.toLowerCase()).includes(userRoleLower);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
