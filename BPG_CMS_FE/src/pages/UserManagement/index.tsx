import React, { useEffect, useState, useCallback } from 'react';
import { userService } from '../../services/userService';
import type { UserProfile } from '../../services/authService';
import { CreateUserModal } from './modals/CreateUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { ConfirmDialog, Button, Select, Badge, DataTable, Pagination } from '../../components/ui';
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { getRoleLabel, getRoleBadgeVariant as getRoleVariant } from '../../utils/roleHelpers';

const PAGE_SIZE = 20;

export const UserManagement: React.FC = () => {
  const [allUsers, setAllUsers] = useState<UserProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const loadAllUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers({
        pageNumber: 1,
        pageSize: 1000,
      });
      setAllUsers(data.items);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(user => {
      const matchSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = !roleFilter || user.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [allUsers, searchTerm, roleFilter]);

  const totalCount = filteredUsers.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const paginatedUsers = React.useMemo(() => {
    const startIndex = (pageNumber - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, pageNumber]);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
    setPageNumber(1);
  };

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
      loadAllUsers();
    } catch (err: any) {
      setError(err.message || 'Không thể xoá tài khoản.');
    }
  };

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      const updated = await userService.toggleUserStatus(id);
      showSuccess(`Đã ${updated.status === 'active' ? 'mở khoá' : 'khoá'} tài khoản ${name}.`);
      loadAllUsers();
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
        <Badge variant={user.status === 'active' ? 'success' : 'danger'} className="normal-case">
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        {/* Filters & Actions bar */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-grow max-w-2xl">
            <div className="relative flex-grow">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm kiếm thành viên..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPageNumber(1);
                }}
                className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-48 shrink-0">
              <Select
                value={roleFilter}
                onChange={handleRoleChange}
                className="h-10"
                options={[
                  { label: 'Tất cả Vai trò', value: '' },
                  { label: 'Admin', value: 'admin' },
                  { label: 'Trưởng phòng Kĩ thuật', value: 'technicalmanager' },
                  { label: 'Nhân viên kỹ thuật', value: 'siteengineer' },
                  { label: 'Kế Toán', value: 'accountant' },
                  { label: 'Giám Đốc', value: 'director' },
                ]}
              />
            </div>
          </div>

          <Button
            variant="primary"
            onClick={() => { setError(null); setIsCreateOpen(true); }}
            className="h-10 font-semibold flex items-center gap-1.5"
          >
            <UserPlus size={18} />
            <span>Thêm Thành viên</span>
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center h-[200px] gap-2.5">
            <Loader2 className="animate-spin text-[hsl(var(--primary))]" size={24} />
            <span className="text-[hsl(var(--text-secondary))]">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col gap-4">
            <DataTable
              columns={columns}
              data={paginatedUsers}
              keyExtractor={(item) => item.id}
              emptyMessage="Không tìm thấy thành viên nào trùng khớp."
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-1 mt-4">
                <span className="text-sm text-[hsl(var(--text-secondary))]">
                  Tổng {totalCount} thành viên
                </span>
                <Pagination
                  currentPage={pageNumber}
                  totalPages={totalPages}
                  onPageChange={setPageNumber}
                  className="mt-0"
                />
              </div>
            )}

            {totalPages <= 1 && totalCount > 0 && (
              <p className="text-sm text-[hsl(var(--text-muted))] px-1 mt-4">Tổng {totalCount} thành viên</p>
            )}
          </div>
        )}
      </div>

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => { showSuccess(msg); setPageNumber(1); loadAllUsers(); }}
      />

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={selectedUser}
        onSuccess={(msg) => { showSuccess(msg); setSelectedUser(null); loadAllUsers(); }}
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
