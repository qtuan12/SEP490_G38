import React, { useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import type { UserDetailProfile } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { User, Mail, Phone, BadgeCheck, Clock, Loader2, KeyRound, CheckCircle2, AlertTriangle, Eye, EyeOff, Pencil, Camera, Check, X } from 'lucide-react';
import { passwordRules, validatePassword } from '../utils/passwordPolicy';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Quản trị viên',
  technicalmanager: 'Trưởng phòng Kỹ thuật',
  projectleader: 'Trưởng dự án',
  siteengineer: 'Nhân viên kỹ thuật',
  accountant: 'Kế toán',
  director: 'Giám đốc',
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const Profile: React.FC = () => {
  const { updateUser } = useAuth();
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
    if (!editFullName.trim()) { setEditError('Họ tên không được để trống.'); return; }

    setEditLoading(true);
    try {
      const updated = await authService.updateProfile(editFullName.trim(), editPhone.trim() || null);
      setProfile(updated);
      updateUser({ name: updated.fullName, avatarUrl: updated.avatarUrl });
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message || 'Cập nhật thất bại.');
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

    setAvatarUploading(true);
    try {
      const avatarUrl = await authService.uploadAvatar(file);
      const updated = await authService.updateProfile(profile.fullName, profile.phoneNumber, avatarUrl);
      setProfile(updated);
      updateUser({ name: updated.fullName, avatarUrl: updated.avatarUrl });
    } catch (err: any) {
      setAvatarError(err.message || 'Tải ảnh đại diện thất bại.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const openModal = () => {
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setPwError(null); setPwSuccess(false);
    setShowModal(true);
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
      setPwError(err.message || 'Đổi mật khẩu thất bại.');
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
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px', margin: '0 auto' }}>

      {/* Profile Card */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <div style={{ height: '88px', background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(220 70% 60%) 100%)' }} />
        <div style={{ padding: '0 28px 24px', position: 'relative' }}>
          <div style={{ position: 'relative', width: '76px', marginTop: '-38px' }}>
            <div style={{
              width: '76px', height: '76px', borderRadius: '50%',
              border: '4px solid hsl(var(--bg-card))',
              background: profile.avatarUrl ? `url(${profile.avatarUrl}) center/cover no-repeat` : 'hsl(var(--primary-glow))',
              color: 'hsl(var(--primary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 700, boxShadow: 'var(--shadow-md)', overflow: 'hidden',
            }}>
              {!profile.avatarUrl && (initials || <User size={30} />)}
              {avatarUploading && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'hsl(224 71% 4% / 0.5)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              title="Đổi ảnh đại diện"
              style={{
                position: 'absolute', right: '-2px', bottom: '-2px',
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'hsl(var(--primary))', color: '#fff', border: '3px solid hsl(var(--bg-card))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: avatarUploading ? 'default' : 'pointer', padding: 0,
              }}
            >
              <Camera size={13} />
            </button>
            <input
              ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarSelect} style={{ display: 'none' }}
            />
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '6px' }}>{profile.fullName}</h2>
              <span className="badge badge-primary">{roleLabel}</span>
              {!profile.isActive && <span className="badge badge-danger" style={{ marginLeft: '8px' }}>Bị khóa</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={openEditModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <Pencil size={15} />
                Chỉnh sửa
              </button>
              <button className="btn btn-secondary" onClick={openModal} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <KeyRound size={15} />
                Đổi mật khẩu
              </button>
            </div>
          </div>
        </div>
      </div>

      {avatarError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px',
          color: 'hsl(346 84% 35%)', fontSize: '0.875rem',
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          {avatarError}
        </div>
      )}

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.95rem' }}>
            Thông tin liên hệ
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InfoRow icon={<Mail size={15} />} label="Email công vụ" value={profile.email} />
            <InfoRow
              icon={<Phone size={15} />} label="Số điện thoại"
              value={profile.phoneNumber ?? <em style={{ color: 'hsl(var(--text-muted))', fontStyle: 'normal' }}>Chưa cập nhật</em>}
            />
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid hsl(var(--border))', fontWeight: 600, fontSize: '0.95rem' }}>
            Thông tin tài khoản
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InfoRow
              icon={<BadgeCheck size={15} />} label="Trạng thái"
              value={<span className={`badge ${profile.isActive ? 'badge-success' : 'badge-danger'}`}>{profile.isActive ? 'Đang hoạt động' : 'Bị khóa'}</span>}
            />
            <InfoRow icon={<Clock size={15} />} label="Đăng nhập gần nhất" value={formatDateTime(profile.lastLoginAt)} />
            <InfoRow icon={<Clock size={15} />} label="Đổi mật khẩu lần cuối" value={formatDateTime(profile.passwordChangedAt)} />
          </div>
        </div>
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
              placeholder="Nhập họ và tên" disabled={editLoading} required
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
              placeholder="Ví dụ: 0912 345 678" disabled={editLoading}
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
            <p style={{ fontWeight: 600, fontSize: '1rem', textAlign: 'center' }}>Đổi mật khẩu thành công!</p>
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

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
    <div style={{ color: 'hsl(var(--text-muted))', marginTop: '2px', flexShrink: 0 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.76rem', color: 'hsl(var(--text-muted))', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</div>
    </div>
  </div>
);

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
