import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../../services/projectService';
import type { Project } from '../../types/common';
import { CreateProjectModal } from './modals/CreateProjectModal';
import { Button, Input, Select, Badge, Pagination, LoadingSpinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/ui/Modal';
import type { BadgeVariant } from '../../components/ui';
import { isPWAMode } from '../../utils/pwaHelpers';
import {
  Search,
  FolderPlus,
  Layers,
  MapPin,
  Calendar,
  ArrowRight,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ClipboardList
} from 'lucide-react';
import { RoleGroup } from '../../auth/roles';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';

export const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canCreateProject = hasAnyRole(RoleGroup.ProjectManagers);
  const canDeleteProject = hasAnyRole(RoleGroup.ProjectManagers);
  const pwa = isPWAMode();
  const showFieldShortcut = pwa && hasAnyRole(['technicalmanager', 'siteengineer']);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form Drawer Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string, name: string } | null>(null);
  const loadRequestIdRef = React.useRef(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const loadProjects = async (silent = false) => {
    const requestId = ++loadRequestIdRef.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await projectService.getProjects();
      if (requestId !== loadRequestIdRef.current) return;
      setProjects(data);
    } catch (err: any) {
      if (requestId !== loadRequestIdRef.current) return;
      if (silent) console.error(err);
      else setError(err.message || 'Không thể tải danh sách dự án.');
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  };

  useRealtimeDataRefresh(
    () => loadProjects(true),
    ['Project', 'ProjectMember', 'Phase', 'ProjectTask'],
  );

  const openDeleteConfirm = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    setProjectToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleteConfirmOpen(false);

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await projectService.deleteProject(projectToDelete.id);
      setSuccess('Đã xóa dự án thành công.');
      loadProjects();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xóa dự án.');
      setLoading(false);
    } finally {
      setProjectToDelete(null);
    }
  };

  useEffect(() => {
    loadProjects();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'draft': return 'Bản nháp';
      case 'inprogress': return 'Đang chạy';
      case 'paused': return 'Tạm dừng';
      case 'done': return 'Hoàn thành';
      default: return status;
    }
  };

  const getStatusBadgeVariant = (status: Project['status']): BadgeVariant => {
    switch (status) {
      case 'draft': return 'default';
      case 'inprogress': return 'success';
      case 'paused': return 'warning';
      case 'done': return 'default'; // primary is not standard BadgeVariant, using default
      default: return 'default';
    }
  };

  const showNoProjectNotice = pwa && !loading && !error && projects.length === 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* PWA: người dùng chưa được gán vào dự án nào */}
      {showNoProjectNotice && (
        <div className="flex items-start gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm py-3 px-4 animate-fade-in">
          <AlertTriangle size={18} className="text-[hsl(var(--danger))] shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold text-[hsl(var(--text-primary))]">Bạn đang không thuộc dự án nào</div>
            <p className="m-0 mt-0.5 text-[hsl(var(--text-secondary))]">
              Vui lòng liên hệ Quản lý kỹ thuật để được thêm vào dự án trước khi ghi nhật ký thi công.
            </p>
          </div>
        </div>
      )}

      {/* Alert Messages */}
      {success && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--success-glow))] border border-[hsl(var(--success)/0.3)] rounded-sm py-3 px-4 text-[hsl(142_70%_35%)] text-[0.9rem] font-medium animate-fade-in">
          <CheckCircle2 size={18} className="text-[hsl(var(--success))]" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 bg-[hsl(var(--danger-glow))] border border-[hsl(var(--danger)/0.3)] rounded-sm py-3 px-4 text-[hsl(346_84%_35%)] text-[0.9rem] font-medium animate-fade-in">
          <AlertTriangle size={18} className="text-[hsl(var(--danger))]" />
          <span>{error}</span>
        </div>
      )}

      {/* Control Actions Header */}
      <div className="glass-panel p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none z-10" />
            <Input
              type="text"
              placeholder="Tìm kiếm dự án theo tên hoặc địa chỉ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 w-full"
            />
          </div>
          <div className="w-full sm:w-52 shrink-0">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-full"
              options={[
                { label: 'Tất cả Trạng thái', value: '' },
                { label: 'Bản nháp', value: 'draft' },
                { label: 'Đang chạy', value: 'inprogress' },
                { label: 'Tạm dừng', value: 'paused' },
                { label: 'Hoàn thành', value: 'done' },
              ]}
            />
          </div>
        </div>

        {/* Add Project Button */}
        {canCreateProject && (
          <Button
            variant="primary"
            onClick={() => {
              setError(null);
              setIsOpen(true);
            }}
            className="h-10 font-semibold w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            <FolderPlus size={18} />
            <span>Khởi tạo Dự án</span>
          </Button>
        )}
      </div>

      {/* Grid Projects Content */}
      {loading ? (
        <div className="flex justify-center items-center h-[240px]">
          <LoadingSpinner size="lg" label="Đang tải danh sách dự án..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProjects.length === 0 ? (
            <div className="card col-span-full text-center py-16 text-[hsl(var(--text-muted))]">
              <Layers size={48} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-[hsl(var(--text-primary))]">Không tìm thấy dự án nào trùng khớp</h3>
              <p className="text-sm mt-1.5">Vui lòng điều chỉnh bộ lọc hoặc tạo dự án mới.</p>
            </div>
          ) : (
            paginatedProjects.map((p) => (
              <div
                key={p.id}
                className="card flex flex-col gap-4 cursor-pointer transition-all duration-200 animate-fade-in hover:-translate-y-1 hover:border-[hsl(var(--primary))] hover:shadow-lg"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                {/* Upper info */}
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-[1.1rem] font-bold leading-tight">{p.name}</h3>
                  <div className="flex items-center gap-2">
                    {canDeleteProject && p.status === 'draft' && (
                      <button
                        onClick={(e) => openDeleteConfirm(e, p.id, p.name)}
                        className="text-[hsl(var(--danger)/0.7)] hover:text-[hsl(var(--danger))] p-1 rounded-md hover:bg-[hsl(var(--danger)/0.1)] transition-colors"
                        title="Xóa dự án"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <Badge variant={getStatusBadgeVariant(p.status)} className="shrink-0">
                      {getStatusLabel(p.status)}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2.5 text-[0.85rem] text-[hsl(var(--text-secondary))] flex-1">
                  <div className="flex gap-2 items-start">
                    <MapPin size={16} className="text-[hsl(var(--text-muted))] shrink-0 mt-0.5" />
                    <span>{p.address}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Calendar size={16} className="text-[hsl(var(--text-muted))] shrink-0" />
                    <span>Hạn: {p.startDate?.split('-').reverse().join('-')} → {p.endDate?.split('-').reverse().join('-')}</span>
                  </div>
                  {p.drawingUrl && (
                    <div className="flex gap-2 items-center text-[hsl(var(--primary-hover))]">
                      <FileText size={16} className="shrink-0" />
                      <span className="underline truncate">
                        Bản vẽ: {p.drawingUrl}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Tiến độ tổng thể:</span>
                    <span className="text-[hsl(var(--primary-hover))]">{p.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[hsl(var(--primary-hover))] to-[hsl(var(--primary))] transition-all duration-400 ease-out" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>

                {/* Action button mock */}
                <div className="flex items-center justify-between gap-2 mt-1 border-t border-[hsl(var(--border)/0.5)] pt-3">
                  <div className="flex items-center gap-1.5 text-[hsl(var(--primary))] text-[0.9rem] font-semibold">
                    <span>Xem chi tiết dự án </span>
                    <ArrowRight size={16} />
                  </div>
                  {showFieldShortcut && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/field?projectId=${p.id}&standalone=true`);
                      }}
                      className="shrink-0 flex items-center gap-1 h-9 px-3 rounded-md bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] text-xs font-semibold"
                      title="Việc của tôi trong dự án này"
                    >
                      <ClipboardList size={14} />
                      Việc của tôi
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <CreateProjectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setSuccess('Khởi tạo Dự án thành công!');
          loadProjects();
        }}
      />

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Xác nhận xóa dự án">
        <div className="flex flex-col gap-4">
          <p>Bạn có chắc chắn muốn xóa dự án bản nháp <strong>{projectToDelete?.name}</strong> không? Hành động này không thể hoàn tác.</p>
          <div className="flex justify-end gap-3 mt-4">
            <button type="button" className="btn btn-secondary px-4 py-2" onClick={() => setDeleteConfirmOpen(false)}>Hủy</button>
            <button type="button" className="btn btn-primary px-4 py-2" style={{ backgroundColor: 'hsl(var(--danger))', borderColor: 'hsl(var(--danger))', color: 'white' }} onClick={confirmDeleteProject}>Xóa dự án</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
