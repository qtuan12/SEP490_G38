import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, LogOut, ClipboardList, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel } from '../utils/roleHelpers';

/**
 * Cảnh báo hiển thị ngay trên trang Cá nhân cho chức vụ không nằm trong nhóm được tối ưu cho PWA.
 * Ở chế độ này người dùng bị khoá lại tại trang Cá nhân, chỉ còn lựa chọn đăng xuất.
 */
export const PWARestrictedNotice: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const roleLabel = user?.role ? getRoleLabel(user.role) : 'chức vụ của bạn';

  return (
    <div className="flex flex-col items-center text-center gap-3 py-5 px-2">
      <div className="w-14 h-14 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] flex items-center justify-center">
        <Monitor size={26} />
      </div>

      <div>
        <h3 className="text-base font-bold m-0 text-[hsl(var(--text-primary))]">
          Giao diện chưa tối ưu cho {roleLabel}
        </h3>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1.5 leading-relaxed m-0">
          Chế độ ứng dụng di động được thiết kế cho Nhân viên kỹ thuật ghi nhật ký ngoài công trường.
          Các chức năng của {roleLabel} cần màn hình lớn nên chỉ dùng được khi đăng nhập trên máy tính.
        </p>
      </div>

      <button
        onClick={() => { logout(); navigate('/login'); }}
        className="w-full max-w-xs h-11 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-primary))] font-semibold text-sm flex items-center justify-center gap-1.5"
      >
        <LogOut size={16} />
        Đăng xuất
      </button>
    </div>
  );
};

/**
 * Nhân viên kỹ thuật mở một màn hình ngoài phạm vi công trường (phiếu kho, đơn mua hàng,
 * nghiệm thu, báo cáo... thường là từ link trong thông báo). Chặn lại và chỉ cho quay về việc của mình.
 */
export const PWAUnsupportedScreenNotice: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-md mx-auto flex flex-col items-center text-center gap-3 py-8 animate-fade-in">
      <div className="w-14 h-14 rounded-full bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] flex items-center justify-center">
        <Smartphone size={26} />
      </div>

      <div>
        <h3 className="text-base font-bold m-0 text-[hsl(var(--text-primary))]">
          Chức năng chưa tối ưu cho di động
        </h3>
        <p className="text-sm text-[hsl(var(--text-secondary))] mt-1.5 leading-relaxed m-0">
          Màn hình này cần bảng biểu và thao tác trên máy tính nên chưa mở ở chế độ ứng dụng di động.
          Trên điện thoại bạn ghi nhật ký thi công và theo dõi công việc của mình; các nội dung khác vui lòng xem trên máy tính.
        </p>
      </div>

      <button
        onClick={() => navigate('/field?standalone=true', { replace: true })}
        className="w-full max-w-xs h-11 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold text-sm flex items-center justify-center gap-1.5 mt-1"
      >
        <ClipboardList size={16} />
        Về Việc của tôi
      </button>
    </div>
  );
};
