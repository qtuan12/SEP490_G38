import React from 'react';
import { ChevronRight } from 'lucide-react';

interface QuickActionsPanelProps {
  userRole?: string;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ userRole }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Phím tắt nhanh</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {userRole === 'admin' && (
          <a href="/users" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all var(--transition-fast)',
            backgroundColor: 'hsl(var(--bg-main) / 0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--primary))';
            e.currentTarget.style.backgroundColor = 'hsl(var(--primary-glow))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'hsl(var(--border))';
            e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main) / 0.2)';
          }}
          >
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>Quản lý Nhân sự</h4>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Thêm mới, chỉnh sửa, gán vai trò</p>
            </div>
            <ChevronRight size={16} />
          </a>
        )}

        <div style={{
          padding: '16px',
          border: '1px dashed hsl(var(--border))',
          borderRadius: 'var(--radius-sm)',
          opacity: 0.7,
          cursor: 'not-allowed'
        }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-muted))' }}>
            Lập kế hoạch WBS
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Khóa bởi nghiệp vụ - Đang xây dựng</p>
        </div>

        <div style={{
          padding: '16px',
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'hsl(var(--bg-main) / 0.2)'
        }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px' }}>
            Kiểm soát Vật tư đền bù
          </h4>
          <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>Xem bảng duyệt Over BOQ ở bên dưới</p>
        </div>
      </div>
    </div>
  );
};
