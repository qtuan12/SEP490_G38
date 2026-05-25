import React, { useState } from 'react';
import { useApp, User } from '@/context/AppContext';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Building2, 
  ShieldCheck, 
  Briefcase, 
  UserCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const { login, users } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Xử lý submit form đăng nhập thủ công
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Vui lòng nhập địa chỉ email.');
      return;
    }
    
    // Kiểm tra định dạng email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Địa chỉ email không đúng định dạng.');
      return;
    }

    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setIsLoading(true);

    // Giả lập thời gian phản hồi mạng 800ms để tạo cảm giác chuyên nghiệp
    setTimeout(() => {
      const success = login(email, password);
      setIsLoading(false);
      if (success) {
        toast.success('Đăng nhập thành công!', {
          description: 'Chào mừng bạn quay trở lại hệ thống BPG Construction.',
        });
      } else {
        setError('Tài khoản hoặc mật khẩu không chính xác. Mật khẩu demo là: password123');
        toast.error('Đăng nhập thất bại', {
          description: 'Vui lòng kiểm tra lại thông tin đăng nhập.',
        });
      }
    }, 800);
  };

  // Đăng nhập nhanh bằng tài khoản Demo
  const handleQuickLogin = (user: User) => {
    setIsLoading(true);
    setEmail(user.email);
    setPassword('password123'); // Mật khẩu demo mặc định trong hệ thống
    setError('');

    setTimeout(() => {
      const success = login(user.email, 'password123');
      setIsLoading(false);
      if (success) {
        toast.success(`Đăng nhập thành công với vai trò ${getRoleLabel(user.role)}!`, {
          description: `Chào mừng ${user.name} quay trở lại.`,
        });
      } else {
        toast.error('Đăng nhập thất bại');
        setIsLoading(false);
      }
    }, 600);
  };

  // Hàm helper lấy nhãn vai trò bằng Tiếng Việt
  const getRoleLabel = (role: User['role']) => {
    switch (role) {
      case 'TPKT':
        return 'Trưởng phòng kỹ thuật';
      case 'Kỹ sư':
        return 'Kỹ sư công trường';
      case 'Kế toán':
        return 'Kế toán vật tư';
      case 'Giám đốc':
        return 'Giám đốc dự án';
      case 'Admin':
        return 'Quản trị viên';
      default:
        return role;
    }
  };

  // Hàm helper lấy màu sắc tương ứng với vai trò
  const getRoleColorClasses = (role: User['role']) => {
    switch (role) {
      case 'TPKT':
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
      case 'Kỹ sư':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
      case 'Kế toán':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
      case 'Giám đốc':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans">
      
      {/* BÊN TRÁI: PANEL THÔNG TIN & THƯƠNG HIỆU (Chỉ hiển thị trên MD trở lên) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 items-center justify-center p-12">
        {/* Hình nền mờ sương sang trọng */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay pointer-events-none scale-105 transition-transform duration-[10000ms] hover:scale-100"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1200&auto=format&fit=crop')" 
          }}
        />
        
        {/* Lớp gradient đè lên nền */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900/95 to-blue-950/80 z-10 pointer-events-none" />

        {/* Vòng tròn hiệu ứng ánh sáng (glowing orb) */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] z-10 pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] z-10 pointer-events-none" />

        {/* Nội dung Panel Trái */}
        <div className="relative z-20 w-full max-w-lg flex flex-col justify-between h-full">
          {/* Logo & Tên dự án */}
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-lg shadow-amber-500/20 text-slate-950">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-white block">BPG Construction</span>
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-500/90 block">Hệ thống quản lý vật tư & công trình</span>
            </div>
          </div>

          {/* Slogan & Giới thiệu tính năng */}
          <div className="my-auto py-12">
            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-6">
              Số hoá quy trình,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">Kiểm soát tiến độ hiệu quả</span>
            </h1>
            <p className="text-slate-300 text-base leading-relaxed mb-8">
              Hệ thống tích hợp tối ưu giúp kết nối các bộ phận tại công trường và văn phòng, kiểm soát hạn mức vật tư chặt chẽ và theo dõi nhật ký thi công thời gian thực.
            </p>

            {/* Các điểm nổi bật (Feature List) */}
            <div className="space-y-4">
              <div className="flex gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all duration-300">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Quản lý vật tư vượt định mức</h3>
                  <p className="text-xs text-slate-400 mt-1">Cảnh báo tức thì khi yêu cầu vật tư vượt quá định mức của giai đoạn thi công.</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 transition-all duration-300">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Kiểm duyệt đa cấp quy trình</h3>
                  <p className="text-xs text-slate-400 mt-1">Phê duyệt nhanh chóng từ Trưởng phòng, Kế toán đến Giám đốc thông qua hệ thống.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bản quyền */}
          <div className="text-xs text-slate-500 flex justify-between items-center border-t border-white/10 pt-4">
            <span>© 2026 BPG Group. Bảo lưu mọi quyền.</span>
            <span>Phiên bản 2.1.0</span>
          </div>
        </div>
      </div>

      {/* BÊN PHẢI: FORM ĐĂNG NHẬP (Chính) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 bg-white relative">
        <div className="w-full max-w-md space-y-8">
          
          {/* Logo hiển thị trên Mobile */}
          <div className="flex lg:hidden items-center gap-3 justify-center mb-6">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg text-slate-950">
              <Building2 className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">BPG Construction</span>
          </div>

          {/* Tiêu đề Form */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Đăng nhập hệ thống</h2>
            <p className="mt-2 text-sm text-slate-500">
              Vui lòng điền thông tin tài khoản của bạn bên dưới
            </p>
          </div>

          {/* Form Đăng Nhập */}
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            {/* Hộp thông báo lỗi */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center gap-2 animate-shake">
                <Info className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Trường Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4.5 h-4.5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="nhanvien@bpg.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all disabled:opacity-55"
                />
              </div>
            </div>

            {/* Trường Mật khẩu */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Mật khẩu
                </label>
                <button
                  type="button"
                  onClick={() => toast.info('Tính năng đang phát triển', { description: 'Vui lòng liên hệ bộ phận IT hoặc sử dụng tài khoản Demo bên dưới.' })}
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all disabled:opacity-55"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Checkbox Duy trì đăng nhập */}
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-500 font-medium selection:bg-transparent">
                Duy trì đăng nhập trên thiết bị này
              </label>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập hệ thống</span>
                </>
              )}
            </button>
          </form>

          {/* Dòng phân cách */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-medium tracking-wide uppercase">Đăng nhập nhanh</span>
            </div>
          </div>

          {/* KHU VỰC TÀI KHOẢN DEMO (Để kiểm thử nhanh các vai trò) */}
          <div className="space-y-3">
            <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-xl flex gap-2.5">
              <UserCheck className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Hệ thống phân quyền theo vai trò. Click trực tiếp vào một tài khoản demo bên dưới để đăng nhập nhanh với vai trò tương ứng:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-56 overflow-y-auto pr-1">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleQuickLogin(user)}
                  disabled={isLoading}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer ${getRoleColorClasses(user.role)} hover:scale-[1.01] hover:shadow-sm`}
                >
                  <img
                    src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border border-white object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-slate-900 truncate">{user.name}</span>
                    <span className="block text-[9px] uppercase tracking-wide font-semibold opacity-85 truncate">
                      {getRoleLabel(user.role)}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-60 ml-auto flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
}
