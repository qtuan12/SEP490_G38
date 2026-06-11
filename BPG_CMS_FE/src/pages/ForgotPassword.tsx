import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Vui lòng điền địa chỉ email.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Simulate request delay
    setTimeout(() => {
      // Check if user exists in localStorage
      const usersStr = localStorage.getItem('bpg_users_list');
      const users = usersStr ? JSON.parse(usersStr) : [
        { email: 'admin@bpg.com' },
        { email: 'tpkt@bpg.com' },
        { email: 'engineer@bpg.com' },
        { email: 'giamdoc@bpg.com' },
        { email: 'ketoan@bpg.com' }
      ];

      const exists = users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());

      if (!exists) {
        setError('Email này không tồn tại trong hệ thống.');
        setLoading(false);
        return;
      }

      setSuccess('Yêu cầu thành công! Chúng tôi đã gửi link đặt lại mật khẩu.');
      // Create mockup direct link to Reset Password page for ease of user testing
      setRecoveryLink(`/reset-password?email=${encodeURIComponent(email)}`);
      setLoading(false);
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
          <h2 className="gradient-text" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>Quên mật khẩu?</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            Nhập email tài khoản của bạn để nhận liên kết khôi phục.
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
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'hsl(var(--success-glow))',
            border: '1px solid hsl(var(--success) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px',
            marginBottom: '20px',
            color: 'hsl(142 72% 20%)',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} style={{ flexShrink: 0, color: 'hsl(var(--success))' }} />
              <strong style={{ fontWeight: 600 }}>{success}</strong>
            </div>
            {recoveryLink && (
              <div style={{
                marginTop: '8px',
                padding: '12px',
                backgroundColor: 'hsl(var(--bg-main))',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed hsl(var(--primary) / 0.3)',
                textAlign: 'center'
              }}>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '8px' }}>
                  [MOCKUP DEMO LINK - Bấm vào nút dưới để đặt lại mật khẩu mà không cần check email thực]
                </p>
                <Link
                  to={recoveryLink}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '6px 12px', width: '100%' }}
                >
                  Đi đến trang Đặt lại mật khẩu
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="email">Email tài khoản</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'hsl(var(--text-muted))'
                }} />
                <input
                  id="email"
                  type="email"
                  placeholder="ten@bpg.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', height: '46px', fontWeight: 600, marginBottom: '16px' }}
              disabled={loading}
            >
              {loading ? 'Đang kiểm tra...' : 'Gửi liên kết khôi phục'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link to="/login" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'hsl(var(--primary))',
            fontSize: '0.9rem',
            textDecoration: 'none',
            fontWeight: 500
          }}>
            <ArrowLeft size={16} />
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
