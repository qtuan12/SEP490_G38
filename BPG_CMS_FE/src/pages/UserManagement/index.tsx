import React, { useEffect, useState, useCallback } from 'react';
import { userService } from '../../services/userService';
import type { PaginatedUsers } from '../../services/userService';
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
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const PAGE_SIZE = 20;

export const UserManagement: React.FC = () => {
  const [result, setResult] = useState<PaginatedUsers | null>(null);
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

  const loadUsers = useCallback(async (page = pageNumber) => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers({
        pageNumber: page,
        pageSize: PAGE_SIZE,
        search: searchTerm || undefined,
        role: roleFilter || undefined,
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, roleFilter, pageNumber]);

  useEffect(() => {
    loadUsers(pageNumber);
  }, [pageNumber]);

  // Khi thay đổi search/filter thì reset về trang 1
  const handleSearch = () => {
    setPageNumber(1);
    loadUsers(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
    setPageNumber(1);
    // trigger load sau khi state cập nhật
    setTimeout(() => loadUsers(1), 0);
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
      loadUsers(pageNumber);
    } catch (err: any) {
      setError(err.message || 'Không thể xoá tài khoản.');
    }
  };

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      const updated = await userService.toggleUserStatus(id);
      showSuccess(`Đã ${updated.status === 'active' ? 'mở khoá' : 'khoá'} tài khoản ${name}.`);
      loadUsers(pageNumber);
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

  const getRoleLabel = (role: string) => {
    if (!role) return '';
    const norm = role.toLowerCase().replace(/[\s_-]/g, '');
    switch (norm) {
      case 'admin': return 'Admin';
      case 'technicalmanager': return 'TP Kỹ Thuật';
      case 'siteengineer': return 'Nhân viên kỹ thuật';
      case 'accountant': return 'Kế Toán';
      case 'director': return 'Giám Đốc';
      default: return role;
    }
  };

  const getRoleVariant = (role: string): BadgeVariant => {
    if (!role) return 'default';
    const norm = role.toLowerCase().replace(/[\s_-]/g, '');
    switch (norm) {
      case 'admin': return 'danger';
      case 'director': return 'warning';
      case 'siteengineer': return 'success';
      default: return 'default';
    }
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

  const totalPages = result?.totalPages ?? 1;
  const totalCount = result?.totalCount ?? 0;

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

      {/* Control Actions Panel */}
      <div className="glass-panel p-5 sm:px-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex gap-3 flex-1 min-w-[280px] flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
            <Input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 h-10"
            />
          </div>
          <Select
            value={roleFilter}
            onChange={handleRoleChange}
            className="w-44 h-10"
            options={[
              { label: 'Tất cả Vai trò', value: '' },
              { label: 'Admin', value: 'admin' },
              { label: 'TP Kỹ Thuật', value: 'technicalmanager' },
              { label: 'Nhân viên kỹ thuật', value: 'siteengineer' },
              { label: 'Kế Toán', value: 'accountant' },
              { label: 'Giám Đốc', value: 'director' },
            ]}
          />
          <Button variant="secondary" onClick={handleSearch} className="h-10">
            Tìm kiếm
          </Button>
        </div>

        <Button
          variant="primary"
          onClick={() => { setError(null); setIsCreateOpen(true); }}
          className="h-10 font-semibold"
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
            data={result?.items ?? []}
            keyExtractor={(item) => item.id}
            emptyMessage="Không tìm thấy thành viên nào trùng khớp."
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-[hsl(var(--text-secondary))]">
                Tổng {totalCount} thành viên &bull; Trang {pageNumber}/{totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="p-2 h-auto"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - pageNumber) <= 1)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-[hsl(var(--text-muted))]">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === pageNumber ? 'primary' : 'secondary'}
                        className="w-9 h-9 p-0 text-sm"
                        onClick={() => setPageNumber(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  variant="secondary"
                  className="p-2 h-auto"
                  disabled={pageNumber >= totalPages}
                  onClick={() => setPageNumber(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {totalPages <= 1 && totalCount > 0 && (
            <p className="text-sm text-[hsl(var(--text-muted))] px-1">Tổng {totalCount} thành viên</p>
          )}
        </div>
      )}

      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => { showSuccess(msg); setPageNumber(1); loadUsers(1); }}
      />

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={selectedUser}
        onSuccess={(msg) => { showSuccess(msg); setSelectedUser(null); loadUsers(pageNumber); }}
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
