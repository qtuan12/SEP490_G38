import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import type { UserDetailProfile } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { User, Mail, Phone, BadgeCheck, Clock, Loader2, KeyRound, CheckCircle2, AlertTriangle, Eye, EyeOff, Pencil, Camera, Check, X, LogOut } from 'lucide-react';
import { passwordRules, validatePassword } from '../utils/passwordPolicy';
import { validateFullName, validatePhoneNumber } from '../utils/profileValidation';
import { formatDateVietnam } from '../utils/dateHelpers';
import { usePWA } from '../context/PWAContext';
import { PWARestrictedNotice } from '../components/PWARestrictedNotice';

import imageCompression from 'browser-image-compression';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  technicalmanager: 'Trưởng phòng Kỹ thuật',
  siteengineer: 'Nhân viên kỹ thuật',
  accountant: 'Kế toán',
  director: 'Giám đốc',
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  return formatDateVietnam(iso);
};

export const Profile: React.FC = () => {
  const { updateUser, logout } = useAuth();
  const { shouldBlock } = usePWA();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserDetailProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Edit profile state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    authService.getMe()
      .then(setProfile)
      .catch((err: Error) => setProfileError(err.message))
      .finally(() => setLoadingProfile(false));
  }, []);

  const openEditModal = () => {
    setEditFullName(profile?.fullName ?? '');
    setEditPhone(profile?.phoneNumber ?? '');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleUpdateProfile = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setEditError(null);

    const nameError = validateFullName(editFullName);
    if (nameError) { setEditError(nameError); return; }

    const phoneError = validatePhoneNumber(editPhone);
    if (phoneError) { setEditError(phoneError); return; }

    setEditLoading(true);
    try {
      const updated = await authService.updateProfile(editFullName.trim(), editPhone.trim() || null);
      setProfile(updated);
      updateUser({ name: updated.fullName, avatarUrl: updated.avatarUrl });
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) return;

    setAvatarError(null);
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận ảnh định dạng JPG, PNG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Kích thước ảnh tối đa là 5MB.');
      return;
    }

    const previousAvatarUrl = profile.avatarUrl;
    const localUrl = URL.createObjectURL(file);
    setProfile(prev => prev ? { ...prev, avatarUrl: localUrl } : null);
    setAvatarUploading(true);

    try {
      let fileToSend = file;
      try {
        fileToSend = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 800,
          useWebWorker: true
        });
      } catch (compressionErr) {
        console.warn("Lỗi nén ảnh avatar:", compressionErr);
      }

      const avatarUrl = await authService.uploadAvatar(fileToSend);
      const updated = await authService.updateProfile(profile.fullName, profile.phoneNumber, avatarUrl);
      setProfile(updated);
      updateUser({ name: updated.fullName, avatarUrl: updated.avatarUrl });
    } catch (err: any) {
      setProfile(prev => prev ? { ...prev, avatarUrl: previousAvatarUrl } : null);
      setAvatarError(err.message || 'Không thể tải ảnh đại diện lên.');
    } finally {
      setAvatarUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const openModal = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setPwError(null); setPwSuccess(false);
    setShowModal(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeModal = () => {
    if (pwLoading) return;
    setShowModal(false);
    // Reload profile để cập nhật "Đổi mật khẩu lần cuối"
    if (pwSuccess) {
      authService.getMe().then(setProfile).catch(() => {});
    }
  };

  const handleChangePassword = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setPwError(null);

    const pwPolicyError = validatePassword(newPassword);
    if (pwPolicyError) { setPwError(pwPolicyError); return; }
    if (newPassword !== confirmPassword) { setPwError('Mật khẩu xác nhận không trùng khớp.'); return; }
    if (currentPassword === newPassword) { setPwError('Mật khẩu mới phải khác mật khẩu hiện tại.'); return; }

    setPwLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setPwSuccess(true);
    } catch (err: any) {
      setPwError(err.message || 'Không thể đổi mật khẩu.');
    } finally {
      setPwLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', gap: '10px' }}>
        <Loader2 className="animate-spin" size={22} style={{ color: 'hsl(var(--primary))' }} />
        <span>Đang tải thông tin...</span>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div style={{ padding: '20px', color: 'hsl(var(--danger))', textAlign: 'center' }}>
        {profileError || 'Không thể tải thông tin cá nhân.'}
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profile.role.toLowerCase()] ?? profile.role;
  const initials = profile.fullName.trim().split(' ').map(w => w[0]).slice(-2).join('').toUpperCase();

  return (
    <div className="animate-fade-in flex flex-col gap-8 w-full">

      {/* PWA: chức vụ không nằm trong nhóm được tối ưu — cảnh báo và lối đi tiếp nằm ngay tại đây */}
      {shouldBlock && (
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] shadow-sm px-4 py-2">
          <PWARestrictedNotice />
        </div>
      )}

      {/* Profile Card */}
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] shadow-sm overflow-hidden">
        <div
          className="relative h-44 sm:h-56"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(258 85% 58%) 55%, hsl(198 90% 55%) 100%)' }}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle at 85% 15%, hsl(0 0% 100% / 0.25), transparent 45%)' }}
          />
        </div>

        <div className="px-8 sm:px-12 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 -mt-12 sm:-mt-16">
            <div className="flex items-end gap-5">
              <div className="relative flex-shrink-0">
                <div
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-4 border-[hsl(var(--bg-card))] shadow-lg overflow-hidden flex items-center justify-center text-4xl font-bold"
                  style={{
                    background: profile.avatarUrl ? `url(${profile.avatarUrl}) center/cover no-repeat` : 'hsl(var(--primary-glow))',
                    color: 'hsl(var(--primary))',
                  }}
                >
                  {!profile.avatarUrl && (initials || <User size={44} />)}
                  {avatarUploading && (
                    <div className="absolute inset-0 rounded-full bg-[hsl(224_71%_4%/0.5)] flex items-center justify-center">
                      <Loader2 size={28} className="animate-spin text-white" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="Đổi ảnh đại diện"
                  className="absolute right-0.5 bottom-0.5 w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-white border-[3px] border-[hsl(var(--bg-card))] flex items-center justify-center shadow-md hover:brightness-110 transition disabled:cursor-default"
                >
                  <Camera size={17} />
                </button>
                <input
                  ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarSelect} className="hidden"
                />
              </div>

              <div className="pb-2">
                <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--text-primary))]">{profile.fullName}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="badge badge-primary text-sm px-3 py-1">{roleLabel}</span>
                  {!profile.isActive && <span className="badge badge-danger text-sm px-3 py-1">Bị khóa</span>}
                </div>
              </div>
            </div>

            <div className="flex gap-3 sm:pb-2">
              <button className="btn btn-secondary flex items-center gap-2 text-sm px-4 py-2.5" onClick={openEditModal}>
                <Pencil size={16} />
                Chỉnh sửa
              </button>
              <button className="btn btn-secondary flex items-center gap-2 text-sm px-4 py-2.5" onClick={openModal}>
                <KeyRound size={16} />
                Đổi mật khẩu
              </button>
              <button className="btn btn-secondary flex items-center gap-2 text-sm px-4 py-2.5 text-[hsl(var(--danger))]" onClick={handleLogout}>
                <LogOut size={16} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>

      {avatarError && (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger-glow))] px-3.5 py-2.5 text-sm text-[hsl(346_84%_35%)]">
          <AlertTriangle size={15} className="flex-shrink-0" />
          {avatarError}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Thông tin liên hệ" icon={<Mail size={18} />}>
          <InfoRow icon={<Mail size={18} />} label="Email công vụ" value={profile.email} accent="primary" />
          <InfoRow
            icon={<Phone size={18} />} label="Số điện thoại" accent="muted"
            value={profile.phoneNumber ?? <span className="italic text-[hsl(var(--text-muted))]">Chưa cập nhật</span>}
          />
        </InfoCard>

        <InfoCard title="Thông tin tài khoản" icon={<BadgeCheck size={18} />}>
          <InfoRow
            icon={<BadgeCheck size={18} />} label="Trạng thái" accent={profile.isActive ? 'success' : 'danger'}
            value={<span className={`badge ${profile.isActive ? 'badge-success' : 'badge-danger'}`}>{profile.isActive ? 'Đang hoạt động' : 'Bị khóa'}</span>}
          />
          <InfoRow icon={<Clock size={18} />} label="Đăng nhập gần nhất" value={formatDateTime(profile.lastLoginAt)} accent="primary" />
          <InfoRow icon={<Clock size={18} />} label="Đổi mật khẩu lần cuối" value={formatDateTime(profile.passwordChangedAt)} accent="warning" />
        </InfoCard>
      </div>

      {/* Edit Profile Modal */}
      <Modal isOpen={showEditModal} onClose={() => !editLoading && setShowEditModal(false)} title="Chỉnh sửa thông tin" width="sm">
        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {editError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              color: 'hsl(346 84% 35%)', fontSize: '0.875rem',
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              {editError}
            </div>
          )}

          <div>
            <label htmlFor="edit-name" style={{ display: 'block', fontSize: '0.82rem', marginBottom: '5px', color: 'hsl(var(--text-secondary))' }}>
              Họ và tên <span style={{ color: 'hsl(var(--danger))' }}>*</span>
            </label>
            <input
              id="edit-name" type="text" value={editFullName}
              onChange={e => setEditFullName(e.target.value)}
              placeholder="Nhập họ và tên" disabled={editLoading} required maxLength={100}
              style={{ height: '38px', width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="edit-phone" style={{ display: 'block', fontSize: '0.82rem', marginBottom: '5px', color: 'hsl(var(--text-secondary))' }}>
              Số điện thoại
            </label>
            <input
              id="edit-phone" type="tel" value={editPhone}
              onChange={e => setEditPhone(e.target.value)}
              placeholder="Ví dụ: 0912 345 678" disabled={editLoading} maxLength={15}
              style={{ height: '38px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowEditModal(false)} disabled={editLoading}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={editLoading || !editFullName.trim()}>
              {editLoading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Loader2 size={15} className="animate-spin" /> Đang lưu...</span>
                : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title="Đổi mật khẩu" width="sm">
        {pwSuccess ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0 6px' }}>
            <CheckCircle2 size={48} style={{ color: 'hsl(var(--success))' }} />
            <p style={{ fontWeight: 600, fontSize: '1rem', textAlign: 'center' }}>Đã đổi mật khẩu.</p>
            <p style={{ fontSize: '0.875rem', color: 'hsl(var(--text-muted))', textAlign: 'center' }}>
              Mật khẩu mới của bạn đã được cập nhật.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeModal}>
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pwError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: 'hsl(var(--danger-glow))',
                border: '1px solid hsl(var(--danger) / 0.3)',
                borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                color: 'hsl(346 84% 35%)', fontSize: '0.875rem',
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                {pwError}
              </div>
            )}

            <PasswordField
              id="current-pw" label="Mật khẩu hiện tại"
              value={currentPassword} onChange={setCurrentPassword}
              show={showCurrent} onToggle={() => setShowCurrent(v => !v)}
              disabled={pwLoading} placeholder="Nhập mật khẩu hiện tại"
            />
            <PasswordField
              id="new-pw" label="Mật khẩu mới"
              value={newPassword} onChange={setNewPassword}
              show={showNew} onToggle={() => setShowNew(v => !v)}
              disabled={pwLoading} placeholder="Nhập mật khẩu mới"
            />

            {newPassword.length > 0 && (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '-8px 0 0', padding: 0, listStyle: 'none' }}>
                {passwordRules.map((rule) => {
                  const ok = rule.test(newPassword);
                  return (
                    <li key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: ok ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' }}>
                      {ok ? <Check size={14} style={{ flexShrink: 0 }} /> : <X size={14} style={{ flexShrink: 0 }} />}
                      <span>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <PasswordField
              id="confirm-pw" label="Xác nhận mật khẩu mới"
              value={confirmPassword} onChange={setConfirmPassword}
              show={showConfirm} onToggle={() => setShowConfirm(v => !v)}
              disabled={pwLoading} placeholder="Nhập lại mật khẩu mới"
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={closeModal} disabled={pwLoading}>
                Hủy
              </button>
              <button
                type="submit" className="btn btn-primary" style={{ flex: 1 }}
                disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwLoading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Loader2 size={15} className="animate-spin" /> Đang lưu...</span>
                  : 'Xác nhận'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};

const InfoCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] shadow-sm overflow-hidden hover:shadow-md transition-shadow">
    <div className="flex items-center gap-2.5 px-6 py-4.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-main))]">
      <span className="text-[hsl(var(--primary))]">{icon}</span>
      <h3 className="font-semibold text-base text-[hsl(var(--text-primary))]">{title}</h3>
    </div>
    <div className="p-7 flex flex-col gap-6">{children}</div>
  </div>
);

const ACCENT_STYLES = {
  primary: { bg: 'hsl(var(--primary-glow))', text: 'hsl(var(--primary))' },
  success: { bg: 'hsl(var(--success-glow))', text: 'hsl(var(--success))' },
  warning: { bg: 'hsl(var(--warning-glow))', text: 'hsl(var(--warning))' },
  danger: { bg: 'hsl(var(--danger-glow))', text: 'hsl(var(--danger))' },
  muted: { bg: 'hsl(var(--bg-main))', text: 'hsl(var(--text-muted))' },
} as const;

const InfoRow: React.FC<{
  icon: React.ReactNode; label: string; value: React.ReactNode;
  accent?: keyof typeof ACCENT_STYLES;
}> = ({ icon, label, value, accent = 'primary' }) => {
  const style = ACCENT_STYLES[accent];
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: style.bg, color: style.text }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--text-muted))] mb-1">{label}</div>
        <div className="text-base font-semibold text-[hsl(var(--text-primary))] truncate">{value}</div>
      </div>
    </div>
  );
};

const PasswordField: React.FC<{
  id: string; label: string; value: string;
  onChange: (v: string) => void; show: boolean;
  onToggle: () => void; disabled: boolean; placeholder: string;
}> = ({ id, label, value, onChange, show, onToggle, disabled, placeholder }) => (
  <div>
    <label htmlFor={id} style={{ display: 'block', fontSize: '0.82rem', marginBottom: '5px', color: 'hsl(var(--text-secondary))' }}>{label}</label>
    <div style={{ position: 'relative' }}>
      <KeyRound size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
      <input
        id={id} type={show ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} required
        style={{ paddingLeft: '34px', paddingRight: '36px', height: '38px', width: '100%' }}
      />
      <button type="button" onClick={onToggle} tabIndex={-1} style={{
        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'hsl(var(--text-muted))',
      }}>
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  </div>
);
