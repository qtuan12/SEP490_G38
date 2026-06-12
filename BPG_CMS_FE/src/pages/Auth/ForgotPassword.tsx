import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, Input, FormItem } from '../../components/ui';

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
    <div className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_top,_hsl(240_100%_96%)_0%,_hsl(var(--bg-main))_70%)]">
      <div className="glass-panel animate-slide-up w-full max-w-[440px] p-10 relative shadow-[0_20px_40px_rgba(0,0,0,0.06),0_0_40px_hsl(var(--primary-glow))]">
        
        {/* Header */}
        <div className="text-center mb-8">
          <img 
            src="/logo.png" 
            alt="BPG Logo" 
            className="h-20 w-20 object-contain mb-4 drop-shadow-md mx-auto"
          />
          <h2 className="gradient-text text-[1.75rem] font-bold mb-1.5">Quên mật khẩu?</h2>
          <p className="text-[hsl(var(--text-secondary))] text-[0.9rem]">
            Nhập email tài khoản của bạn để nhận liên kết khôi phục.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="animate-fade-in flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm p-3 mb-5 text-[hsl(346_84%_35%)] text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="animate-fade-in flex flex-col gap-3 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.2)] rounded-sm p-4 mb-5 text-[hsl(142_72%_20%)] text-sm">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0 text-[hsl(var(--success))]" />
              <strong className="font-semibold">{success}</strong>
            </div>
            {recoveryLink && (
              <div className="mt-2 p-3 bg-[hsl(var(--bg-main))] rounded-sm border border-dashed border-[hsl(var(--primary)/0.3)] text-center">
                <p className="text-xs text-[hsl(var(--text-muted))] mb-2">
                  [MOCKUP DEMO LINK - Bấm vào nút dưới để đặt lại mật khẩu mà không cần check email thực]
                </p>
                <Link
                  to={recoveryLink}
                  className="btn btn-primary text-[0.85rem] py-1.5 px-3 w-full inline-block"
                >
                  Đi đến trang Đặt lại mật khẩu
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FormItem label="Email tài khoản">
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <Input
                  type="email"
                  placeholder="ten@bpg.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="pl-10"
                />
              </div>
            </FormItem>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 h-[46px] font-semibold mb-4"
              disabled={loading}
              isLoading={loading}
            >
              Gửi liên kết khôi phục
            </Button>
          </form>
        )}

        <div className="text-center mt-4">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[hsl(var(--primary))] text-[0.9rem] font-medium no-underline hover:underline">
            <ArrowLeft size={16} />
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
