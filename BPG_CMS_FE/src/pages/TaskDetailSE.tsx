import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, Users, FileText, Plus, ClipboardList } from 'lucide-react';
import { isPWAMode } from '../utils/pwaHelpers';
import { wbsService } from '../services/wbsService';
import type { TaskDetails } from '../types/wbs';
import type { WBSTask } from '../types/common';
import { Badge, LoadingSpinner } from '../components/ui';
import type { BadgeVariant } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useProjectAccess } from '../hooks/useProjectAccess';
import { canCreateDailyLog, hasSiteEngineerRole } from '../utils/taskPermissions';
import { DailyLogFormModal } from './ProjectDailyLogs/modals/DailyLogFormModal';
import { useRealtimeDataRefresh } from '../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../constants/realtimeEntities';
import { RoleGroup } from '../auth/roles';
import { formatDateOnly, formatPlainDate, todayVnISO, toInputDate } from '../utils/dateHelpers';

const STATUS_LABEL: Record<string, string> = {
  New: 'Mới',
  Assigned: 'Đã giao',
  InProgress: 'Đang thực hiện',
  Completed: 'Hoàn thành',
  Approved: 'Đã nghiệm thu',
  Obsolete: 'Đã hủy',
};

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  New: 'default',
  Assigned: 'info',
  InProgress: 'warning',
  Completed: 'success',
  Approved: 'success',
  Obsolete: 'danger',
};

/** Ngày thuần (hạn công việc) — không quy đổi múi giờ. */
const formatTaskDate = (iso?: string | null): string => formatPlainDate(iso) || '—';

/** Mốc thời gian UTC từ backend (thời điểm cập nhật tiến độ). */
const formatTimestamp = (iso?: string | null): string => (iso ? formatDateOnly(iso) : '—');

export const TaskDetailSE: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const pwa = isPWAMode();

  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const { isProjectLeader, isProjectMember } = useProjectAccess(detail ? String(detail.projectId) : undefined);
  const canDecreaseDailyLogProgress = hasAnyRole(RoleGroup.Technical);

  const loadDetail = useCallback((silent = false) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    return wbsService.getTaskDetails(Number(taskId))
      .then(details => {
        // Ngoài PWA (desktop): giữ hành vi cũ — mở task trong WBS hub đầy đủ thay vì trang gọn này.
        if (!pwa) {
          navigate(`/projects/${details.projectId}?tab=wbs&taskId=${taskId}`, { replace: true });
          return;
        }
        setError(null);
        setDetail(details);
      })
      .catch((err: any) => {
        if (silent) console.error(err);
        else setError(err.message || 'Không tìm thấy thông tin công việc.');
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [navigate, pwa, taskId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useRealtimeDataRefresh(
    () => pwa ? loadDetail(true) : undefined,
    RealtimeEntities.projects,
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-4 text-slate-600 dark:text-slate-400">
        <AlertCircle size={48} className="text-red-500 mb-2" />
        <p className="text-lg font-semibold">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (loading || !pwa || !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <LoadingSpinner size="lg" label="Đang tải thông tin chi tiết công việc..." />
      </div>
    );
  }

  const overdue = !['Completed', 'Approved', 'Obsolete'].includes(detail.status)
    && toInputDate(detail.endDate) < todayVnISO();

  // Chỉ Site Engineer được gán vào task hoặc Site Engineer là Project Leader được tạo nhật ký.
  const taskForModal: WBSTask = {
    id: String(detail.taskId),
    phaseId: String(detail.phaseId),
    projectId: String(detail.projectId),
    name: detail.name,
    assignedTo: detail.assignees.map(a => String(a.userId)).join(','),
    assignedName: detail.assignees.map(a => a.fullName).join(', '),
    sortOrder: 0,
    deadline: detail.endDate,
    progress: detail.progressPercent,
    status: detail.status === 'Obsolete' ? 'obsolete' : undefined,
    hasSubTasks: detail.hasSubTasks,
    history: [],
  };
  const canCreateLog = detail.status !== 'Obsolete'
    && canCreateDailyLog(taskForModal, user, isProjectLeader, isProjectMember);

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in pb-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 self-start bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-sm font-medium hover:text-[hsl(var(--primary))]"
      >
        <ArrowLeft size={16} />
        <span>Quay lại</span>
      </button>

      <div className="card p-4 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold m-0 text-[hsl(var(--text-primary))]">{detail.name}</h2>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant={STATUS_VARIANT[detail.status] || 'default'}>
              {STATUS_LABEL[detail.status] || detail.status}
            </Badge>
            {detail.hasSubTasks && <Badge variant="info">Công việc tổng hợp</Badge>}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-[hsl(var(--text-secondary))]">Tiến độ</span>
            <span className="text-[hsl(var(--primary))]">{detail.progressPercent}%</span>
          </div>
          <div className="h-2 bg-[hsl(var(--border))] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--primary-hover))] to-[hsl(var(--primary))] transition-all duration-400 ease-out"
              style={{ width: `${detail.progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Calendar size={15} className="text-[hsl(var(--text-muted))] shrink-0" />
          <span className={overdue ? 'text-[hsl(var(--danger))] font-semibold' : 'text-[hsl(var(--text-secondary))]'}>
            Hạn: {formatTaskDate(detail.endDate)}{overdue && ' (Quá hạn)'}
          </span>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <Users size={15} className="text-[hsl(var(--text-muted))] shrink-0 mt-0.5" />
          <span className="text-[hsl(var(--text-secondary))]">
            {detail.assignees.length > 0 ? detail.assignees.map(a => a.fullName).join(', ') : 'Chưa có người phụ trách'}
          </span>
        </div>

        {detail.description && (
          <p className="text-sm text-[hsl(var(--text-secondary))] whitespace-pre-wrap m-0 border-t border-[hsl(var(--border)/0.5)] pt-3">
            {detail.description}
          </p>
        )}

        {detail.hasSubTasks && (
          <p className="text-xs text-[hsl(var(--text-muted))] m-0 border-t border-[hsl(var(--border)/0.5)] pt-3">
            Tiến độ được tổng hợp từ các công việc con.
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        {canCreateLog && (
          <button
            onClick={() => setLogModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold text-sm"
          >
            <Plus size={16} />
            Nhật ký mới
          </button>
        )}
        <button
          onClick={() => navigate(`/projects/${detail.projectId}/tasks/${detail.taskId}/logs`)}
          className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] font-semibold text-sm text-[hsl(var(--text-primary))]"
        >
          <FileText size={16} />
          Xem nhật ký
        </button>
      </div>

      {/* Recent progress history */}
      {detail.progressLogs.length > 0 && (
        <section className="card p-3 flex flex-col gap-2">
          <h3 className="text-sm font-semibold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
            <ClipboardList size={16} />
            Lịch sử cập nhật tiến độ
          </h3>
          <div className="flex flex-col gap-2">
            {detail.progressLogs.slice(0, 5).map(log => (
              <div key={log.logId} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] text-xs">
                <span className="font-medium text-[hsl(var(--text-primary))]">{log.oldProgress}% &rarr; {log.newProgress}%</span>
                <span className="text-[hsl(var(--text-muted))] shrink-0">{formatTimestamp(log.updatedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {logModalOpen && user && (
        <DailyLogFormModal
          isOpen={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          task={taskForModal}
          engineerId={user.id}
          engineerName={user.name}
          canCreate={canCreateLog}
          isSiteEngineer={hasSiteEngineerRole(user)}
          canManageTechnical={canDecreaseDailyLogProgress}
          onSuccess={() => {
            setLogModalOpen(false);
            loadDetail();
          }}
        />
      )}
    </div>
  );
};
