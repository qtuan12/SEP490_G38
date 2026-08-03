import React, { useEffect, useState, useCallback } from 'react';
import { userService } from '../../services/userService';
import type { UserProfile } from '../../services/authService';
import { CreateUserModal } from './modals/CreateUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { ConfirmDialog, Button, Select, Badge, DataTable, Pagination, LoadingSpinner } from '../../components/ui';
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  AlertCircle,
  User as UserIcon,
  Phone,
  Mail
} from 'lucide-react';
import { getRoleLabel, getRoleBadgeVariant as getRoleVariant } from '../../utils/roleHelpers';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import toast from 'react-hot-toast';

const PAGE_SIZE = 20;

export const UserManagement: React.FC = () => {
  const [allUsers, setAllUsers] = useState<UserProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pageNumber, setPageNumber] = useState(1);

  // Modal control states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const loadRequestIdRef = React.useRef(0);

  const loadAllUsers = useCallback(async (silent = false) => {
    const requestId = ++loadRequestIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await userService.getUsers({
        pageNumber: 1,
        pageSize: 1000,
      });
      if (requestId !== loadRequestIdRef.current) return;
      setAllUsers(data.items);
    } catch (err: any) {
      if (requestId !== loadRequestIdRef.current) return;
      if (silent) console.error(err);
      else setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, []);

  useRealtimeDataRefresh(() => loadAllUsers(true), ['User', 'UserRole']);

  useEffect(() => {
    loadAllUsers();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadAllUsers]);

  const filteredUsers = React.useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(user => {
      const matchSearch = !searchTerm || 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.phoneNumber && user.phoneNumber.includes(searchTerm));
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
    toast.success(message);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;
    try {
      const result = await userService.deleteUser(selectedUser.id);
      setIsDeleteOpen(false);
      showSuccess(result.message || `Đã xoá tài khoản ${selectedUser.name} khỏi hệ thống.`);
      setSelectedUser(null);
      loadAllUsers();
    } catch (err: any) {
      toast.error(err.message || 'Không thể xoá tài khoản.');
    }
  };

  const handleToggleStatus = async (id: string, name: string) => {
    try {
      const result = await userService.toggleUserStatus(id);
      showSuccess(result.message || `Đã ${result.data.status === 'active' ? 'mở khoá' : 'khoá'} tài khoản ${name}.`);
      loadAllUsers();
    } catch (err: any) {
      toast.error(err.message || 'Không thể thay đổi trạng thái tài khoản.');
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
      render: (user: UserProfile) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900">{user.name}</span>
            {user.phoneNumber && (
              <span className="text-xs text-slate-500">{user.phoneNumber}</span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email tài khoản',
      render: (user: UserProfile) => <span className="text-slate-600 text-sm">{user.email}</span>
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
      align: 'center' as const,
      render: (user: UserProfile) => (
        <div className="flex gap-2 justify-center">
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title={user.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
            onClick={() => handleToggleStatus(user.id, user.name)}
          >
            {user.status === 'active'
              ? <Lock size={15} className="text-amber-600" />
              : <Unlock size={15} className="text-emerald-600" />
            }
          </Button>
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Sửa thông tin"
            onClick={() => openEditModal(user)}
          >
            <Edit2 size={15} className="text-blue-600" />
          </Button>
          <Button
            variant="secondary"
            className="p-2 h-auto"
            title="Xóa tài khoản"
            onClick={() => openDeleteModal(user)}
          >
            <Trash2 size={15} className="text-red-600" />
          </Button>
        </div>
      ),
    }
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 animate-fade-in max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserIcon className="text-blue-600 shrink-0" size={24} />
            <span>Quản lý Thành viên</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý tài khoản, phân quyền vai trò và trạng thái hoạt động trong hệ thống BPG
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => { setError(null); setIsCreateOpen(true); }}
          className="h-10 font-semibold flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 shadow-sm"
        >
          <UserPlus size={18} />
          <span>Thêm Thành viên</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl py-3 px-4 text-red-800 text-sm font-medium animate-fade-in shadow-sm">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="bg-transparent border-none text-inherit cursor-pointer opacity-70 hover:opacity-100 p-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-4">
        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email hoặc SĐT..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPageNumber(1);
              }}
              className="pl-9 pr-4 py-2 w-full text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50 focus:bg-white transition-colors"
            />
          </div>
          <div className="w-full sm:w-56 shrink-0">
            <Select
              value={roleFilter}
              onChange={handleRoleChange}
              className="h-10 rounded-xl"
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

        {/* Content Area */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <LoadingSpinner size="lg" label="Đang tải danh sách thành viên..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <UserIcon size={36} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">Không tìm thấy thành viên nào trùng khớp.</p>
            <p className="text-xs text-slate-400 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc vai trò.</p>
          </div>
        ) : (
          <div className="animate-fade-in flex flex-col gap-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <DataTable
                columns={columns}
                data={paginatedUsers}
                keyExtractor={(item) => item.id}
                emptyMessage="Không tìm thấy thành viên nào."
              />
            </div>

            {/* Mobile & PWA Responsive Cards View */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {paginatedUsers.map((u) => (
                <div 
                  key={u.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">{u.name}</h4>
                        <div className="flex items-center gap-1 text-xs text-slate-500 truncate mt-0.5">
                          <Mail size={12} className="shrink-0 text-slate-400" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={getRoleVariant(u.role)} className="shrink-0 text-[10px]">
                      {getRoleLabel(u.role)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <Badge variant={u.status === 'active' ? 'success' : 'danger'} className="normal-case text-[10px]">
                        {u.status === 'active' ? 'Đang hoạt động' : 'Bị khóa'}
                      </Badge>
                      {u.phoneNumber && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone size={11} className="text-slate-400" />
                          {u.phoneNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u.id, u.name)}
                        className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
                        title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa'}
                      >
                        {u.status === 'active'
                          ? <Lock size={14} className="text-amber-600" />
                          : <Unlock size={14} className="text-emerald-600" />
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-blue-600 transition-colors"
                        title="Sửa thông tin"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openDeleteModal(u)}
                        className="p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-red-600 transition-colors"
                        title="Xóa tài khoản"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <span className="text-xs text-slate-500">
                  Hiển thị {(pageNumber - 1) * PAGE_SIZE + 1} - {Math.min(pageNumber * PAGE_SIZE, totalCount)} trên {totalCount} thành viên
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
              <p className="text-xs text-slate-400 pt-1">Tổng cộng {totalCount} thành viên</p>
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
