import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, KeyRound, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Quản trị viên (Admin)';
      case 'technicalmanager': return 'Trưởng phòng Kỹ Thuật';
      case 'projectleader': return 'Trưởng Dự án';
      case 'siteengineer': return 'Kỹ Sư Hiện Trường';
      case 'accountant': return 'Kế Toán';
      case 'director': return 'Giám Đốc';
      default: return role;
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ các ô nhập.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận mới không trùng khớp.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Simulate password change
    setTimeout(() => {
      // Find current password in database
      const defaultPasswords: Record<string, string> = {
        'admin@bpg.com': 'admin123',
        'tpkt@bpg.com': 'tpkt123',
        'engineer@bpg.com': 'eng123',
        'giamdoc@bpg.com': 'gd123',
        'ketoan@bpg.com': 'kt123'
      };

      const customPasswordsStr = localStorage.getItem('bpg_custom_passwords');
      const customPasswords = customPasswordsStr ? JSON.parse(customPasswordsStr) : {};
      
      const emailKey = user.email.toLowerCase();
      const currentPassword = customPasswords[emailKey] || defaultPasswords[emailKey] || '123456';

      if (oldPassword !== currentPassword) {
        setError('Mật khẩu cũ không chính xác.');
        setLoading(false);
        return;
      }

      // Update password
      customPasswords[emailKey] = newPassword;
      localStorage.setItem('bpg_custom_passwords', JSON.stringify(customPasswords));

      setSuccess('Đổi mật khẩu thành công! Hệ thống sẽ ghi nhận mật khẩu mới.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setLoading(false);
    }, 1000);
  };

  if (!user) {
    return <div>Vui lòng đăng nhập để xem hồ sơ.</div>;
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Messages */}
      {success && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(142 70% 30%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} style={{ color: 'hsl(var(--success))' }} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(346 84% 35%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--danger))' }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Read-Only Info Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '12px' }}>
            Thông tin nhân sự
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'hsl(var(--primary-glow))',
              color: 'hsl(var(--primary))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid hsl(var(--primary) / 0.2)'
            }}>
              <User size={40} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user.name}</h4>
              <span className="badge badge-primary" style={{ marginTop: '6px' }}>{getRoleLabel(user.role)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.925rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Email công vụ:</span>
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{user.email}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Mã nhân viên:</span>
              <strong style={{ color: 'hsl(var(--text-primary))' }}>{user.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Trạng thái tài khoản:</span>
              <span className="badge badge-success">Đang hoạt động</span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))', paddingBottom: '12px', marginBottom: '20px' }}>
            Đổi mật khẩu
          </h3>
          
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="old-pass">Mật khẩu hiện tại</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  id="old-pass"
                  type="password"
                  placeholder="Nhập mật khẩu hiện tại"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-pass">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  id="new-pass"
                  type="password"
                  placeholder="Từ 6 ký tự trở lên"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-pass">Xác nhận mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  id="confirm-pass"
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '38px' }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', height: '42px', fontWeight: 600 }}
              disabled={loading}
            >
              {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        </div>

      </div>

      {/* Safety Notice */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'hsl(var(--warning-glow))', border: '1px solid hsl(var(--warning) / 0.2)' }}>
        <ShieldAlert size={20} style={{ color: 'hsl(var(--warning))', flexShrink: 0 }} />
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.4 }}>
          <strong>Lưu ý bảo mật:</strong> Mật khẩu của bạn được sử dụng để phê duyệt các hồ sơ nghiệm thu kỹ thuật và lập báo cáo vật tư. Tránh chia sẻ tài khoản hoặc sử dụng mật khẩu dễ đoán.
        </p>
      </div>

    </div>
  );
};
