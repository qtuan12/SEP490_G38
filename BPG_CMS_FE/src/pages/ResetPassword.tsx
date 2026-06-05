import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    setError(null);

    // Simulate database update delay
    setTimeout(() => {
      // Save password change in localStorage to override mock passwords
      const customPasswordsStr = localStorage.getItem('bpg_custom_passwords');
      const customPasswords = customPasswordsStr ? JSON.parse(customPasswordsStr) : {};
      customPasswords[email.toLowerCase()] = password;
      localStorage.setItem('bpg_custom_passwords', JSON.stringify(customPasswords));

      setSuccess(true);
      setLoading(false);
      
      // Auto redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    }, 1000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, hsl(240 100% 96%) 0%, hsl(var(--bg-main)) 70%)',
      padding: '20px'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '40px',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.06), 0 0 40px hsl(var(--primary-glow))'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src="/logo.png" 
            alt="BPG Logo" 
            style={{ 
              height: '80px', 
              width: '80px', 
              objectFit: 'contain',
              marginBottom: '16px',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.08))'
            }} 
          />
          <h2 className="gradient-text" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Đặt lại mật khẩu</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            Tài khoản: <strong style={{ color: 'hsl(var(--text-primary))' }}>{email || 'Chưa xác định'}</strong>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="animate-fade-in" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'hsl(var(--danger-glow))',
            border: '1px solid hsl(var(--danger) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px',
            marginBottom: '20px',
            color: 'hsl(346 84% 35%)',
            fontSize: '0.875rem'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="animate-fade-in" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'hsl(var(--success-glow))',
            border: '1px solid hsl(var(--success) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '20px',
            color: 'hsl(142 72% 20%)',
            fontSize: '0.875rem'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, color: 'hsl(var(--success))' }} />
            <div>
              <strong style={{ fontWeight: 600 }}>Đặt lại mật khẩu thành công!</strong>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Đang tự động chuyển hướng về trang Đăng nhập...</p>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="password">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'hsl(var(--text-muted))'
                }} />
                <input
                  id="password"
                  type="password"
                  placeholder="Nhập mật khẩu mới"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  disabled={loading || !email}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'hsl(var(--text-muted))'
                }} />
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  disabled={loading || !email}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', height: '46px', fontWeight: 600 }}
              disabled={loading || !email}
            >
              {loading ? 'Đang cập nhật...' : 'Xác nhận mật khẩu mới'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/login" style={{
            color: 'hsl(var(--text-secondary))',
            fontSize: '0.9rem',
            textDecoration: 'none',
            fontWeight: 500
          }}>
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};
