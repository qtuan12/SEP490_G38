import React, { useEffect, useState } from 'react';
import { userService } from '../services/userService';
import type { UserProfile } from '../services/authService';
import { Modal } from '../components/Modal';
import { 
  Search, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Lock, 
  Unlock, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'kỹ sư' as UserProfile['role']
  });

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Show auto-dismissing success notifications
  const showSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    try {
      await userService.createUser(formData);
      setIsCreateOpen(false);
      showSuccess(`Đã tạo tài khoản cho ${formData.name} thành công.`);
      setFormData({ name: '', email: '', role: 'kỹ sư' });
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo tài khoản.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!formData.name || !formData.email) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    try {
      await userService.updateUser(selectedUser.id, formData);
      setIsEditOpen(false);
      showSuccess(`Đã cập nhật tài khoản ${formData.name} thành công.`);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật tài khoản.');
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    try {
      await userService.deleteUser(selectedUser.id);
      setIsDeleteOpen(false);
      showSuccess(`Đã xoá tài khoản ${selectedUser.name} khỏi hệ thống.`);
      setSelectedUser(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Không thể xoá tài khoản.');
    }
  };

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      const updated = await userService.toggleUserStatus(id);
      showSuccess(`Đã ${updated.status === 'active' ? 'mở khoá' : 'khoá'} tài khoản ${name}.`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Không thể thay đổi trạng thái tài khoản.');
    }
  };

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role
    });
    setIsEditOpen(true);
  };

  const openDeleteModal = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteOpen(true);
  };

  // Filtering users logic
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === '' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'tpkt': return 'TP Kỹ Thuật';
      case 'kỹ sư': return 'Kỹ Sư';
      case 'giám đốc': return 'Giám Đốc';
      case 'kế toán': return 'Kế Toán';
      default: return role;
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Messages */}
      {success && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(142 70% 70%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} style={{ color: 'hsl(var(--success))' }} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(346 84% 75%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <AlertCircle size={18} style={{ color: 'hsl(var(--danger))' }} />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)} 
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Control Actions Panel */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))'
            }} />
            <input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px', height: '40px' }}
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: '160px', height: '40px' }}
          >
            <option value="">Tất cả Vai trò</option>
            <option value="admin">Admin</option>
            <option value="tpkt">Trưởng phòng Kỹ thuật</option>
            <option value="kỹ sư">Nhân viên Kỹ thuật</option>
            <option value="giám đốc">Giám Đốc</option>
            <option value="kế toán">Kế Toán</option>
          </select>
        </div>

        {/* Add button */}
        <button
          onClick={() => {
            setError(null);
            setFormData({ name: '', email: '', role: 'kỹ sư' });
            setIsCreateOpen(true);
          }}
          className="btn btn-primary"
          style={{ height: '40px', fontWeight: 600 }}
        >
          <UserPlus size={18} />
          <span>Thêm Thành viên</span>
        </button>
      </div>

      {/* Table Section */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', gap: '10px' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải dữ liệu...</span>
        </div>
      ) : (
        <div className="table-container animate-fade-in">
          <table>
            <thead>
              <tr>
                <th>Tên thành viên</th>
                <th>Email tài khoản</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                    Không tìm thấy thành viên nào trùng khớp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td style={{ color: 'hsl(var(--text-secondary))' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'admin' ? 'badge-danger' : 
                        u.role === 'tpkt' ? 'badge-primary' : 
                        u.role === 'kỹ sư' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ textTransform: 'none' }}>
                        {u.status === 'active' ? 'Đang hoạt động' : 'Bị khóa'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          onClick={() => handleToggleStatus(u.id, u.name)}
                          className="btn btn-secondary"
                          title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                          style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
                        >
                          {u.status === 'active' ? <Lock size={15} style={{ color: 'hsl(var(--warning))' }} /> : <Unlock size={15} style={{ color: 'hsl(var(--success))' }} />}
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="btn btn-secondary"
                          title="Sửa thông tin"
                          style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
                        >
                          <Edit2 size={15} style={{ color: 'hsl(var(--primary-hover))' }} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(u)}
                          className="btn btn-secondary"
                          title="Xóa tài khoản"
                          style={{ padding: '8px', borderRadius: 'var(--radius-sm)' }}
                        >
                          <Trash2 size={15} style={{ color: 'hsl(var(--danger))' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE MODAL */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Thêm Thành viên mới">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="create-name">Họ và Tên <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="create-name"
              type="text"
              placeholder="Nhập tên nhân viên"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="create-email">Địa chỉ Email <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="create-email"
              type="email"
              placeholder="nhanvien@bpg.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="create-role">Vai trò hệ thống</label>
            <select
              id="create-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserProfile['role'] })}
            >
              <option value="admin">Hệ thống Admin</option>
              <option value="tpkt">Trưởng phòng Kỹ thuật (TPKT)</option>
              <option value="kỹ sư">Nhân viên Kỹ thuật (Kỹ sư)</option>
              <option value="giám đốc">Giám Đốc</option>
              <option value="kế toán">Kế Toán</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Xác nhận</button>
          </div>
        </form>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Cập nhật thông tin thành viên">
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="edit-name">Họ và Tên <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="edit-email">Địa chỉ Email <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="edit-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label htmlFor="edit-role">Vai trò hệ thống</label>
            <select
              id="edit-role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserProfile['role'] })}
            >
              <option value="admin">Hệ thống Admin</option>
              <option value="tpkt">Trưởng phòng Kỹ thuật (TPKT)</option>
              <option value="kỹ sư">Nhân viên Kỹ thuật (Kỹ sư)</option>
              <option value="giám đốc">Giám Đốc</option>
              <option value="kế toán">Kế Toán</option>
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEditOpen(false)}>Hủy</button>
            <button type="submit" className="btn btn-primary">Lưu thay đổi</button>
          </div>
        </form>
      </Modal>

      {/* DELETE MODAL */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Xóa tài khoản thành viên">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
            Bạn có chắc chắn muốn xóa tài khoản của thành viên <strong>{selectedUser?.name}</strong> (`{selectedUser?.email}`) khỏi hệ thống? 
            Hành động này không thể hoàn tác.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setIsDeleteOpen(false)}>Hủy bỏ</button>
            <button className="btn btn-danger" onClick={handleDeleteSubmit}>Đồng ý xóa</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
