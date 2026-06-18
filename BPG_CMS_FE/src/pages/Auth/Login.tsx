import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, AlertTriangle } from 'lucide-react';
import { Button, Input, FormItem } from '../../components/ui';

const getRoleDashboard = (role: string): string => {
  switch (role) {
    case 'technicalmanager':
    case 'siteengineer':
      return '/projects';
    default:
      return '/dashboard';
  }
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        setError(`${err.message || 'Đăng nhập thất bại.'} (Bạn còn ${5 - currentAttempts} lần thử)`);
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
            src="/logo.png" 
            alt="BPG Logo" 
            className="h-20 w-20 object-contain mb-4 drop-shadow-md mx-auto"
          />
          <h2 className="gradient-text text-[1.75rem] font-bold mb-1.5">BPG CMS</h2>
          <p className="text-[hsl(var(--text-secondary))] text-[0.9rem]">
            Hệ thống Quản lý Thi công & Kiểm soát Vật tư
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="animate-fade-in flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.2)] rounded-sm p-3 mb-5 text-[hsl(346_84%_35%)] text-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

          <FormItem label="Mật khẩu">
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="pl-10"
              />
            </div>
          </FormItem>

          <div className="flex justify-end -mt-2">
            <Link to="/forgot-password" className="text-[hsl(var(--primary))] text-[0.85rem] font-medium no-underline hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

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

        {/* Developer Cheat Sheet */}
        <div className="mt-8 pt-5 border-t border-[hsl(var(--border))] text-xs text-[hsl(var(--text-muted))]">
          <p className="font-medium text-[hsl(var(--text-secondary))] mb-2">
            Tài khoản dùng thử (Mock Accounts):
          </p>
          <div className="grid grid-cols-2 gap-2 leading-relaxed">
            <div>
              <strong>Admin:</strong> admin@bpg.com<br />
              <strong>Pass:</strong> 123456
            </div>
            <div>
              <strong>TPKT:</strong> tpkt@bpg.com<br />
              <strong>Pass:</strong> 123456
            </div>
            <div>
              <strong>Kỹ sư:</strong> kysu1@bpg.com<br />
              <strong>Pass:</strong> 123456
            </div>
            <div>
              <strong>Giám đốc:</strong> giamdoc@bpg.com<br />
              <strong>Pass:</strong> 123456
            </div>
            <div>
              <strong>Kế toán:</strong> ketoan@bpg.com<br />
              <strong>Pass:</strong> 123456
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
