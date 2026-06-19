import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, AlertTriangle, KeyRound } from 'lucide-react';
import { Button, Input, FormItem } from '../../components/ui';
import { authService } from '../../services/authService';

type Step = 'email' | 'otp';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setStep('otp');
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || 'Gửi OTP thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resetToken = await authService.verifyOtp(email, otp.trim());
      navigate(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (err: any) {
      setError(err.message || 'Xác thực OTP thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setOtp('');
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || 'Gửi lại OTP thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_top,_hsl(240_100%_96%)_0%,_hsl(var(--bg-main))_70%)]">
      <div className="glass-panel animate-slide-up w-full max-w-[440px] p-10 relative shadow-[0_20px_40px_rgba(0,0,0,0.06),0_0_40px_hsl(var(--primary-glow))]">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="BPG Logo" className="h-20 w-20 object-contain mb-4 drop-shadow-md mx-auto" />
          <h2 className="gradient-text text-[1.75rem] font-bold mb-1.5">Quên mật khẩu?</h2>
          <p className="text-[hsl(var(--text-secondary))] text-[0.9rem]">
            {step === 'email'
              ? 'Nhập email tài khoản để nhận mã OTP xác thực.'
              : <>Mã OTP đã được gửi đến <strong className="text-[hsl(var(--text-primary))]">{email}</strong></>
            }
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="animate-fade-in flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm p-3 mb-5 text-[hsl(346_84%_35%)] text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-6">
            <FormItem label="Email tài khoản">
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <Input
                  type="email"
                  placeholder="ten@bpg.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="pl-10"
                />
              </div>
            </FormItem>
            <Button type="submit" variant="primary" className="w-full py-3 h-[46px] font-semibold mb-2" disabled={loading} isLoading={loading}>
              Gửi mã OTP
            </Button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
            <FormItem label="Mã OTP (6 số)">
              <div className="relative">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Nhập 6 chữ số"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  required
                  maxLength={6}
                  className="pl-10 tracking-widest text-center text-lg"
                />
              </div>
            </FormItem>
            <Button type="submit" variant="primary" className="w-full py-3 h-[46px] font-semibold" disabled={loading || otp.length !== 6} isLoading={loading}>
              Xác nhận OTP
            </Button>
            <div className="text-center text-sm text-[hsl(var(--text-secondary))]">
              Không nhận được mã?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="text-[hsl(var(--primary))] font-medium hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : 'Gửi lại'}
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[hsl(var(--primary))] text-[0.9rem] font-medium no-underline hover:underline">
            <ArrowLeft size={16} />
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
