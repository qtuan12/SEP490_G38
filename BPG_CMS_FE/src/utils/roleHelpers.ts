import type { BadgeVariant } from '../components/ui/Badge';

export const getRoleLabel = (role: string): string => {
  if (!role) return '';
  const norm = role.toLowerCase().replace(/[\s_-]/g, '');
  switch (norm) {
    case 'admin': return 'Admin';
    case 'technicalmanager': return 'TP Kỹ Thuật';
    case 'siteengineer': return 'Nhân viên kỹ thuật';
    case 'projectleader': return 'Trưởng Dự án';
    case 'director': return 'Giám đốc';
    case 'accountant': return 'Kế toán';
    default: return role;
  }
};

export const getRoleBadgeVariant = (role: string): BadgeVariant => {
  if (!role) return 'default';
  const norm = role.toLowerCase().replace(/[\s_-]/g, '');
  switch (norm) {
    case 'admin': return 'danger';
    case 'director': return 'warning';
    case 'siteengineer': return 'success';
    case 'technicalmanager':
    case 'projectleader':
    case 'accountant':
      return 'default';
    default:
      return 'default';
  }
};
