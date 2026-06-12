import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickActionsPanelProps {
  userRole?: string;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ userRole }) => {
  return (
    <div className="card flex flex-col gap-5">
      <h3 className="text-[1.15rem] font-semibold">Phím tắt nhanh</h3>
      
      <div className="flex flex-col gap-3">
        {userRole === 'admin' && (
          <Link 
            to="/users" 
            className="flex items-center justify-between p-4 border border-[hsl(var(--border))] rounded-sm text-inherit transition-all duration-200 bg-[hsl(var(--bg-main)/0.2)] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-glow))] no-underline group"
          >
            <div>
              <h4 className="text-[0.9rem] font-semibold mb-0.5 group-hover:text-[hsl(var(--primary))] transition-colors">Quản lý Nhân sự</h4>
              <p className="text-[0.75rem] text-[hsl(var(--text-secondary))] m-0">Thêm mới, chỉnh sửa, gán vai trò</p>
            </div>
            <ChevronRight size={16} className="text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--primary))] transition-colors" />
          </Link>
        )}

        <div className="p-4 border border-dashed border-[hsl(var(--border))] rounded-sm opacity-70 cursor-not-allowed">
          <h4 className="text-[0.9rem] font-semibold mb-0.5 text-[hsl(var(--text-muted))]">
            Lập kế hoạch WBS
          </h4>
          <p className="text-[0.75rem] text-[hsl(var(--text-muted))] m-0">Khóa bởi nghiệp vụ - Đang xây dựng</p>
        </div>

        <div className="p-4 border border-[hsl(var(--border))] rounded-sm bg-[hsl(var(--bg-main)/0.2)]">
          <h4 className="text-[0.9rem] font-semibold mb-0.5">
            Kiểm soát Vật tư đền bù
          </h4>
          <p className="text-[0.75rem] text-[hsl(var(--text-secondary))] m-0">Xem bảng duyệt Over BOQ ở bên dưới</p>
        </div>
      </div>
    </div>
  );
};
