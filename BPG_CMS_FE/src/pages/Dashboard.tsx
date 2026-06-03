import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Layers, 
  AlertTriangle, 
  ClipboardList, 
  Users, 
  Clock, 
  TrendingUp,
  ChevronRight,
  TrendingDown
} from 'lucide-react';
import { userService } from '../services/userService';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const list = await userService.getUsers();
        setUserCount(list.length);
      } catch (err) {
        console.error('Error fetching users for stats:', err);
      }
    };
    fetchUsers();
  }, []);

  const stats = [
    { title: 'Dự án đang chạy', value: '3', change: '+1 trong tháng', isPositive: true, icon: <Layers size={24} />, color: 'hsl(var(--primary))' },
    { title: 'Yêu cầu Vật tư chờ duyệt', value: '4', change: '2 Vượt định mức', isPositive: false, icon: <AlertTriangle size={24} />, color: 'hsl(var(--danger))' },
    { title: 'Nhật ký thi công hôm nay', value: '12', change: '100% đầy đủ ảnh', isPositive: true, icon: <ClipboardList size={24} />, color: 'hsl(var(--success))' },
    { title: 'Tổng số nhân viên', value: userCount.toString(), change: 'Cập nhật thời gian thực', isPositive: true, icon: <Users size={24} />, color: 'hsl(var(--primary-hover))' },
  ];

  const recentActivities = [
    { id: 1, user: 'Nguyễn Văn Kỹ', role: 'TP Kỹ Thuật', action: 'Nghiệm thu Phase 1: Móng & Cột', time: '10 phút trước', detail: 'Dự án Chung cư BPG - Biên bản nghiệm thu PDF đã ký số.' },
    { id: 2, user: 'Trần Văn Công', role: 'Kỹ Sư', action: 'Cập nhật tiến độ: Đổ bê tông dầm sàn', time: '35 phút trước', detail: 'Tiến độ task tăng lên 60% (+15%). Đính kèm 3 hình ảnh.' },
    { id: 3, user: 'Lê Thị Thu', role: 'Kế Toán', action: 'Tạo đơn đặt hàng PO-2026-0048', time: '2 giờ trước', detail: 'Vật tư: Xi măng Hải Vân (150 bao), Đơn giá: 85,000đ.' },
    { id: 4, user: 'Phạm Huy Hoàng', role: 'Giám Đốc', action: 'Duyệt yêu cầu vật tư vượt định mức', time: '4 giờ trước', detail: 'Dự án Cải tạo văn phòng FPT - Xi măng vượt định mức 15% (đã có giải trình).' },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Welcome Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        background: 'linear-gradient(135deg, hsl(var(--bg-card-glass)) 0%, hsl(var(--primary-glow)) 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>
            Chào mừng trở lại, <span style={{ color: 'hsl(var(--primary-hover))' }}>{user?.name}</span>!
          </h2>
          <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '600px', lineHeight: 1.5 }}>
            Bạn đang truy cập hệ thống với vai trò <strong style={{ color: 'hsl(var(--text-primary))' }}>{user?.role.toUpperCase()}</strong>. 
            Mọi hành động kiểm soát tiến độ & vật tư đều được lưu nhật ký hệ thống tự động.
          </p>
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: 'hsl(var(--bg-main))',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid hsl(var(--border))',
          fontSize: '0.85rem'
        }}>
          <Shield size={16} style={{ color: 'hsl(var(--success))' }} />
          <span>Hệ thống bảo mật & ghi log hoạt động (Active)</span>
        </div>
      </div>

      {/* Grid Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '24px'
      }}>
        {stats.map((stat, i) => (
          <div key={i} className="card" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            transition: 'transform var(--transition-fast), border-color var(--transition-fast)',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'hsl(var(--border))';
          }}
          >
            <div>
              <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
                {stat.title}
              </span>
              <h3 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
                {stat.value}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                {stat.isPositive ? (
                  <TrendingUp size={14} style={{ color: 'hsl(var(--success))' }} />
                ) : (
                  <TrendingDown size={14} style={{ color: 'hsl(var(--danger))' }} />
                )}
                <span style={{ color: stat.isPositive ? 'hsl(142 70% 60%)' : 'hsl(346 84% 65%)', fontWeight: 600 }}>
                  {stat.change}
                </span>
              </div>
            </div>
            <div style={{
              backgroundColor: 'hsl(var(--bg-main))',
              color: stat.color,
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid hsl(var(--border))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '24px',
        alignItems: 'flex-start'
      }}>
        {/* Recent Activities / site diary */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Hoạt động & Nhật ký mới nhận</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => navigate('/projects')}>
              Xem toàn bộ
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentActivities.map((act) => (
              <div key={act.id} style={{
                padding: '16px',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'hsl(var(--bg-main) / 0.4)',
                display: 'flex',
                gap: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'hsl(var(--border))',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  color: 'hsl(var(--text-secondary))',
                  flexShrink: 0,
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}>
                  {act.user.charAt(0)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                      {act.user} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--text-muted))' }}>({act.role})</span>
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {act.time}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>
                    {act.action}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
                    {act.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Phím tắt nhanh</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user?.role === 'admin' && (
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
              border: '1px dashed hsl(var(--border))',
              borderRadius: 'var(--radius-sm)',
              opacity: 0.7,
              cursor: 'not-allowed'
            }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-muted))' }}>
                Duyệt yêu cầu vật tư
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Yêu cầu quyền Giám đốc/Kế toán</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
