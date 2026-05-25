import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail, AlertTriangle, ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin đăng nhập.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, hsl(262 80% 92%) 0%, hsl(var(--bg-main)) 70%)',
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
          <div style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            background: 'hsl(var(--primary-glow))',
            color: 'hsl(var(--primary))',
            marginBottom: '16px',
            border: '1px solid hsl(var(--primary) / 0.1)'
          }}>
            <ShieldCheck size={32} />
          </div>
          <h2 className="gradient-text" style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '6px' }}>BPG CMS</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            Hệ thống Quản lý Thi công & Kiểm soát Vật tư
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
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

          <div style={{ marginBottom: '28px' }}>
            <label htmlFor="password">Mật khẩu</label>
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
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '40px' }}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', height: '46px', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? 'Đang xác thực...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Developer Cheat Sheet */}
        <div style={{
          marginTop: '32px',
          paddingTop: '20px',
          borderTop: '1px solid hsl(var(--border))',
          fontSize: '0.8rem',
          color: 'hsl(var(--text-muted))'
        }}>
          <p style={{ fontWeight: 500, color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
            Tài khoản dùng thử (Mock Accounts):
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <strong>Admin:</strong> admin@bpg.com<br />
              <strong>Pass:</strong> admin123
            </div>
            <div>
              <strong>TPKT:</strong> tpkt@bpg.com<br />
              <strong>Pass:</strong> tpkt123
            </div>
            <div>
              <strong>Kỹ sư:</strong> engineer@bpg.com<br />
              <strong>Pass:</strong> eng123
            </div>
            <div>
              <strong>Giám đốc:</strong> giamdoc@bpg.com<br />
              <strong>Pass:</strong> gd123
            </div>
            <div>
              <strong>Kế toán:</strong> ketoan@bpg.com<br />
              <strong>Pass:</strong> kt123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
