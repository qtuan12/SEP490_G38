import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Button, Input, FormItem } from '../../components/ui';

import { isPWAMode } from '../../utils/pwaHelpers';

const FIELD_ROLES = ['technicalmanager', 'projectleader', 'siteengineer'];

const getRoleDashboard = (role: string): string => {
  const normRole = role?.toLowerCase() || '';
  if (isPWAMode() && FIELD_ROLES.includes(normRole)) {
    return '/field?standalone=true';
  }
  switch (normRole) {
    case 'admin':
      return '/users';
    case 'siteengineer':
      return '/field';
    case 'technicalmanager':
    case 'projectleader':
      return '/projects';
    default:
      return '/dashboard';
  }
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { companyName, companyLogoUrl } = useCompany();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  // Lockout countdown effect
  useEffect(() => {
    if (lockoutTimeLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeLeft]);

  const checkLockout = (userEmail: string): boolean => {
    const key = `bpg_lock_time_${userEmail.toLowerCase()}`;
    const lockTimeStr = localStorage.getItem(key);
    if (lockTimeStr) {
      const lockTime = parseInt(lockTimeStr, 10);
      const now = Date.now();
      const elapsed = now - lockTime;
      const fifteenMinutes = 15 * 60 * 1000;
      
      if (elapsed < fifteenMinutes) {
        const remainingSeconds = Math.ceil((fifteenMinutes - elapsed) / 1000);
        setLockoutTimeLeft(remainingSeconds);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        setError(`Tài khoản tạm thời bị khóa do nhập sai quá nhiều lần. Thử lại sau ${minutes}p ${seconds}s.`);
        return true;
      } else {
        localStorage.removeItem(key);
        localStorage.removeItem(`bpg_failed_attempts_${userEmail.toLowerCase()}`);
      }
    }
    return false;
  };

  useEffect(() => {
    if (email) {
      checkLockout(email);
    } else {
      setError(null);
      setLockoutTimeLeft(0);
    }
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ thông tin đăng nhập.');
      return;
    }

    if (checkLockout(email)) {
      return;
    }

    setLoading(true);
    setError(null);

    const emailKey = email.toLowerCase();
    const attemptsKey = `bpg_failed_attempts_${emailKey}`;

    try {
      const loggedInUser = await login({ email, password });
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(`bpg_lock_time_${emailKey}`);
      navigate(getRoleDashboard(loggedInUser.role), { replace: true });
    } catch (err: any) {
      if (err.message && err.message.includes('bị khóa')) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const currentAttempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
      localStorage.setItem(attemptsKey, currentAttempts.toString());
      
      if (currentAttempts >= 5) {
        const now = Date.now();
        localStorage.setItem(`bpg_lock_time_${emailKey}`, now.toString());
        setLockoutTimeLeft(15 * 60);
        setError('Tài khoản đã bị khóa trong 15 phút do nhập sai mật khẩu 5 lần.');
      } else {
        setError(err.message || 'Đăng nhập thất bại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-[radial-gradient(circle_at_top,_hsl(240_100%_96%)_0%,_hsl(var(--bg-main))_70%)]">
      <div className="glass-panel animate-slide-up w-full max-w-[440px] p-10 relative shadow-[0_20px_40px_rgba(0,0,0,0.06),0_0_40px_hsl(var(--primary-glow))]">
        
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src={companyLogoUrl}
            alt={`${companyName} Logo`}
            className="h-20 w-20 object-contain mb-4 drop-shadow-md mx-auto"
          />
          <h2 className="gradient-text text-[1.75rem] font-bold mb-1.5">{companyName}</h2>
          <p className="text-[hsl(var(--text-secondary))] text-[0.9rem]">
            Hệ thống Quản lý Thi công & Kiểm soát Vật tư
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FormItem label="Email tài khoản">
            <div className="relative">
              <Input
                type="email"
                placeholder="ten@bpg.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="pl-10"
              />
              <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
            </div>
          </FormItem>

          <FormItem label="Mật khẩu">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-10 pr-10"
              />
              <KeyRound size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-secondary))] transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </FormItem>

          <div className="flex justify-end -mt-2">
            <Link to="/forgot-password" className="text-[hsl(var(--primary))] text-[0.85rem] font-medium no-underline hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

          {/* Error Alert — đặt ngay trên nút để người dùng đọc lỗi rồi thử lại */}
          {error && (
            <div className="animate-fade-in flex items-start gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-md p-3 text-[hsl(346_84%_35%)] text-sm leading-snug">
              <AlertTriangle size={18} className="shrink-0 mt-px" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 h-[46px] font-semibold mt-1"
            disabled={loading || lockoutTimeLeft > 0}
            isLoading={loading}
          >
            {lockoutTimeLeft > 0 ? 'Tài khoản đang bị khóa' : 'Đăng nhập'}
          </Button>
        </form>
      </div>
    </div>
  );
};
