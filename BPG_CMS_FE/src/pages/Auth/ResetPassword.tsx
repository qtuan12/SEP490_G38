import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, Input, FormItem } from '../../components/ui';
import { authService } from '../../services/authService';

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(resetToken, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const isInvalid = !resetToken;

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_top,_hsl(240_100%_96%)_0%,_hsl(var(--bg-main))_70%)]">
      <div className="glass-panel animate-slide-up w-full max-w-[440px] p-10 relative shadow-[0_20px_40px_rgba(0,0,0,0.06),0_0_40px_hsl(var(--primary-glow))]">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="BPG Logo" className="h-20 w-20 object-contain mb-4 drop-shadow-md mx-auto" />
          <h2 className="gradient-text text-[1.75rem] font-bold mb-1.5">Đặt lại mật khẩu</h2>
          <p className="text-[hsl(var(--text-secondary))] text-[0.9rem]">Nhập mật khẩu mới cho tài khoản của bạn.</p>
        </div>

        {/* Invalid token */}
        {isInvalid && (
          <div className="flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm p-3 mb-5 text-[hsl(346_84%_35%)] text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>Liên kết không hợp lệ. Vui lòng thực hiện lại từ trang quên mật khẩu.</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="animate-fade-in flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm p-3 mb-5 text-[hsl(346_84%_35%)] text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="animate-fade-in flex items-center gap-2.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.2)] rounded-sm p-4 mb-5 text-[hsl(142_72%_20%)] text-sm">
            <CheckCircle2 size={18} className="shrink-0 text-[hsl(var(--success))]" />
            <div>
              <strong className="font-semibold block mb-1">Đặt lại mật khẩu thành công!</strong>
              <p className="text-[0.8rem] m-0">Đang chuyển hướng về trang Đăng nhập...</p>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && !isInvalid && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FormItem label="Mật khẩu mới">
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu mới"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pl-10"
                />
              </div>
            </FormItem>

            <FormItem label="Xác nhận mật khẩu">
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <Input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="pl-10"
                />
              </div>
            </FormItem>

            <Button type="submit" variant="primary" className="w-full py-3 h-[46px] font-semibold mt-2 mb-2" disabled={loading} isLoading={loading}>
              Xác nhận mật khẩu mới
            </Button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-[hsl(var(--text-secondary))] text-[0.9rem] font-medium no-underline hover:text-[hsl(var(--primary))] transition-colors">
            Quay lại Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};
