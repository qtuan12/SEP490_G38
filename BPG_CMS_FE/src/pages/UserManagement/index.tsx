import React, { useEffect, useState } from 'react';
import { userService } from '../../services/userService';
import type { UserProfile } from '../../services/authService';
import { CreateUserModal } from './modals/CreateUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { ConfirmDialog, Button, Input, Select, Badge, DataTable } from '../../components/ui';
import type { BadgeVariant } from '../../components/ui';
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
      case 'technicalmanager': return 'TP Kỹ Thuật';
      case 'projectleader': return 'Trưởng Dự án';
      case 'siteengineer': return 'Kỹ Sư Hiện Trường';
      case 'accountant': return 'Kế Toán';
      case 'director': return 'Giám Đốc';
      default: return role;
    }
  };

  const getRoleVariant = (role: string): BadgeVariant => {
    switch (role) {
      case 'admin': return 'danger';
      case 'director': return 'warning';
      case 'siteengineer': return 'success';
      case 'technicalmanager':
      case 'projectleader':
      case 'accountant': return 'default'; // primary doesn't exist on Badge, using default
      default: return 'default';
    }
  };

  // DataTable columns
  const columns = [
    {
      key: 'name',
      header: 'Tên thành viên',
      render: (user: UserProfile) => <span className="font-semibold">{user.name}</span>
    },
    {
      key: 'email',
      header: 'Email tài khoản',
      render: (user: UserProfile) => <span className="text-[hsl(var(--text-secondary))]">{user.email}</span>
    },
    {
      key: 'role',
      header: 'Vai trò',
      render: (user: UserProfile) => (
        <Badge variant={getRoleVariant(user.role)}>
          {getRoleLabel(user.role)}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (user: UserProfile) => (
        <Badge 
          variant={user.status === 'active' ? 'success' : 'danger'} 
          className="normal-case"
        >
          {user.status === 'active' ? 'Đang hoạt động' : 'Bị khóa'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Hành động',
      render: (user: UserProfile) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
            onClick={() => handleToggleStatus(user.id, user.name)}
          >
            {user.status === 'active' 
              ? <Lock size={15} className="text-[hsl(var(--warning))]" /> 
              : <Unlock size={15} className="text-[hsl(var(--success))]" />
            }
          </Button>
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Sửa thông tin"
            onClick={() => openEditModal(user)}
          >
            <Edit2 size={15} className="text-[hsl(var(--primary-hover))]" />
          </Button>
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Xóa tài khoản"
            onClick={() => openDeleteModal(user)}
          >
            <Trash2 size={15} className="text-[hsl(var(--danger))]" />
          </Button>
        </div>
      ),
      
    }
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      
      {/* Messages */}
      {success && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.3)] rounded-sm py-3 px-4 text-[hsl(142_70%_35%)] text-sm font-medium animate-fade-in">
          <CheckCircle2 size={18} className="text-[hsl(var(--success))] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm py-3 px-4 text-[hsl(346_84%_35%)] text-sm font-medium animate-fade-in">
          <AlertCircle size={18} className="text-[hsl(var(--danger))] shrink-0" />
          <span>{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="ml-auto bg-transparent border-none text-inherit cursor-pointer opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Control Actions Panel */}
      <div className="glass-panel p-5 sm:px-6 flex justify-between items-center flex-wrap gap-4">
        {/* Filters */}
        <div className="flex gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
            <Input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-40 h-10"
            options={[
              { label: 'Tất cả Vai trò', value: '' },
              { label: 'Admin', value: 'admin' },
              { label: 'TP Kỹ Thuật', value: 'technicalmanager' },
              { label: 'Trưởng Dự án', value: 'projectleader' },
              { label: 'Kỹ Sư Hiện Trường', value: 'siteengineer' },
              { label: 'Kế Toán', value: 'accountant' },
              { label: 'Giám Đốc', value: 'director' },
            ]}
          />
        </div>

        {/* Add button */}
        <Button
          variant="primary"
          onClick={() => {
            setError(null);
            setIsCreateOpen(true);
          }}
          className="h-10 font-semibold"
        >
          <UserPlus size={18} />
          <span>Thêm Thành viên</span>
        </Button>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="flex justify-center items-center h-[200px] gap-2.5">
          <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={24} />
          <span className="text-[hsl(var(--text-secondary))]">Đang tải dữ liệu...</span>
        </div>
      ) : (
        <div className="animate-fade-in">
          <DataTable
            columns={columns}
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            emptyMessage="Không tìm thấy thành viên nào trùng khớp."
          />
        </div>
      )}

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => {
          showSuccess(msg);
          loadUsers();
        }}
      />

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={selectedUser}
        onSuccess={(msg) => {
          showSuccess(msg);
          setSelectedUser(null);
          loadUsers();
        }}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteSubmit}
        title="Xóa tài khoản thành viên"
        message={`Bạn có chắc chắn muốn xóa tài khoản của thành viên ${selectedUser?.name || ''} (${selectedUser?.email || ''}) khỏi hệ thống? Hành động này không thể hoàn tác.`}
        confirmText="Đồng ý xóa"
      />
    </div>
  );
};
