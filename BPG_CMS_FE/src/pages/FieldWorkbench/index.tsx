import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, FileText, ChevronRight, Plus, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { DailyLogFormModal } from '../ProjectDailyLogs/modals/DailyLogFormModal';
import { Badge, Modal, Input } from '../../components/ui';
import { getRoleLabel, getRoleBadgeVariant } from '../../utils/roleHelpers';
import { IOSInstallBanner } from '../../components/IOSInstallBanner';
import { TaskRow, formatAssignees } from '../../components/field/TaskRow';
import { isProjectWideView as computeIsProjectWideView, canCreateDailyLog, getVisibleTasksForUser, hasSiteEngineerRole } from '../../utils/taskPermissions';
import type { Project, WBSTask, DailyLog } from '../../types/common';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { RoleGroup } from '../../auth/roles';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import { isPWAMode } from '../../utils/pwaHelpers';
import { RealtimeEntityGroups } from '../../constants/realtimeEntities';

const LAST_PROJECT_KEY = 'field_workbench_last_project';

const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-[hsl(var(--border))] rounded-md ${className}`} />
);

const SkeletonRow: React.FC = () => (
  <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))]">
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      <SkeletonBlock className="h-3.5 w-3/5" />
      <SkeletonBlock className="h-2.5 w-1/4" />
    </div>
    <SkeletonBlock className="h-9 w-16 shrink-0" />
  </div>
);

const FieldWorkbenchSkeleton: React.FC = () => (
  <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in pb-8">
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-col gap-1.5">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-4 w-20" />
      </div>
    </div>
    <SkeletonBlock className="h-[52px] w-full" />
    <div className="flex gap-2">
      <SkeletonBlock className="h-12 flex-1" />
      <SkeletonBlock className="h-12 flex-1" />
    </div>
    <div className="card p-3 flex flex-col gap-2">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonRow />
      <SkeletonRow />
    </div>
    <div className="card p-3 flex flex-col gap-2">
      <SkeletonBlock className="h-4 w-32" />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  </div>
);

export const FieldWorkbench: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [logModalTaskId, setLogModalTaskId] = useState<string | null>(null);
  const { isProjectLeader, isProjectMember } = useProjectAccess(projectId);
  const canDecreaseDailyLogProgress = hasAnyRole(RoleGroup.Technical);

  useEffect(() => {
    projectService.getProjects().then(list => {
      setProjects(list);
      // PWA: chưa thuộc dự án nào thì đưa thẳng về màn hình danh sách dự án (có thông báo ở đó).
      if (list.length === 0 && isPWAMode()) {
        navigate('/projects', { replace: true });
        return;
      }
      const saved = localStorage.getItem(LAST_PROJECT_KEY);
      const initial = (requestedProjectId && list.some(p => p.id === requestedProjectId))
        ? requestedProjectId
        : (saved && list.some(p => p.id === saved)) ? saved : (list[0]?.id || '');
      setProjectId(initial);
    }).catch(console.error).finally(() => setLoadingProjects(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedProjectId]);

  const loadProjectDetail = useCallback((pid: string, silent = false) => {
    if (!silent) setLoadingDetail(true);
    return Promise.all([
      projectService.getTasks(pid),
      projectService.getDailyLogsPage(pid, 1, 5),
    ]).then(([tasksData, logsResult]) => {
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
      setRecentLogs(logsResult.items);
    }).catch(console.error).finally(() => { if (!silent) setLoadingDetail(false); });
  }, []);

  useRealtimeDataRefresh(
    () => projectId ? loadProjectDetail(projectId, true) : undefined,
    RealtimeEntityGroups.projectOverview,
  );

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
    loadProjectDetail(projectId);
  }, [projectId, loadProjectDetail]);

  const canCreateLogFor = (task: WBSTask) => canCreateDailyLog(
    task,
    user,
    isProjectLeader,
    isProjectMember,
  );

  // TM/Admin/leader thật của dự án này xem toàn bộ công việc; Site Engineer chỉ xem đúng việc được gán cho mình.
  const isProjectWideView = computeIsProjectWideView(user, isProjectLeader);

  const allMyTasks = useMemo(
    () => getVisibleTasksForUser(tasks, user, isProjectWideView),
    [tasks, user, isProjectWideView]
  );

  const myTasks = allMyTasks.slice(0, 5);

  const creatableTasks = useMemo(
    () => tasks.filter(t => canCreateDailyLog(t, user, isProjectLeader, isProjectMember)),
    [tasks, user, isProjectLeader, isProjectMember]
  );

  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskPickerQuery, setTaskPickerQuery] = useState('');

  const filteredCreatableTasks = useMemo(() => {
    const q = taskPickerQuery.trim().toLowerCase();
    if (!q) return creatableTasks;
    return creatableTasks.filter(t => t.name.toLowerCase().includes(q));
  }, [creatableTasks, taskPickerQuery]);

  const handleCreateLogClick = () => {
    if (creatableTasks.length === 0) return;
    if (creatableTasks.length === 1) {
      setLogModalTaskId(creatableTasks[0].id);
    } else {
      setTaskPickerQuery('');
      setTaskPickerOpen(true);
    }
  };

  const selectedProject = projects.find(p => p.id === projectId);

  if (loadingProjects) {
    return <FieldWorkbenchSkeleton />;
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold m-0 text-[hsl(var(--text-primary))]">Chào, {user?.name}</h2>
          {user?.role && (
            <Badge variant={getRoleBadgeVariant(user.role)} className="mt-1 text-[10px]">
              {getRoleLabel(user.role)}
            </Badge>
          )}
        </div>
      </div>

      <IOSInstallBanner />

      {/* Project context */}
      <div className="card p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[hsl(var(--text-secondary))]">Dự án</div>
          {selectedProject ? (
            <div className="text-sm font-semibold truncate text-[hsl(var(--text-primary))]">{selectedProject.name}</div>
          ) : (
            <p className="text-sm text-[hsl(var(--text-muted))] m-0">Bạn chưa được gán vào dự án nào.</p>
          )}
        </div>
        {projects.length > 0 && (
          <button
            onClick={() => navigate('/projects')}
            className="shrink-0 text-xs font-medium text-[hsl(var(--primary))]"
          >
            Đổi dự án
          </button>
        )}
      </div>

      {selectedProject && (
        <>
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateLogClick}
              disabled={creatableTasks.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={creatableTasks.length === 0 ? 'Bạn chưa được gán công việc nào để báo cáo' : undefined}
            >
              <Plus size={16} />
              Nhật ký mới
            </button>
            <button
              onClick={() => navigate(`/projects/${projectId}/logs`)}
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] font-semibold text-sm text-[hsl(var(--text-primary))]"
            >
              <FileText size={16} />
              Xem nhật ký
            </button>
          </div>

          {loadingDetail ? (
            <>
              <div className="card p-3 flex flex-col gap-2">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonRow />
                <SkeletonRow />
              </div>
              <div className="card p-3 flex flex-col gap-2">
                <SkeletonBlock className="h-4 w-32" />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            </>
          ) : (
            <>
              {/* My tasks */}
              <section className="card p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
                    <ClipboardList size={16} />
                    {isProjectWideView ? 'Công việc dự án' : 'Việc của tôi'}
                  </h3>
                  {/* Bottom nav không còn tab "Công việc" — đây là lối vào duy nhất tới trang công việc */}
                  <button
                    onClick={() => navigate(`/field/tasks?projectId=${projectId}`)}
                    className="text-xs font-medium text-[hsl(var(--primary))] flex items-center gap-0.5"
                  >
                    Xem thêm <ChevronRight size={12} />
                  </button>
                </div>
                {myTasks.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--text-muted))] m-0">
                    {isProjectWideView ? 'Dự án chưa có công việc nào.' : 'Bạn chưa được gán công việc nào trong dự án này.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myTasks.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        currentUserId={user?.id}
                        canCreateLog={canCreateLogFor(task)}
                        showAssignee={isProjectWideView}
                        onOpen={() => navigate(`/tasks/${task.id.replace(/^t-/, '')}`)}
                        onCreateLog={() => setLogModalTaskId(task.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Recent daily logs */}
              <section className="card p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
                    <FileText size={16} />
                    Nhật ký gần đây
                  </h3>
                  <button
                    onClick={() => navigate(`/projects/${projectId}/logs`)}
                    className="text-xs font-medium text-[hsl(var(--primary))] flex items-center gap-0.5"
                  >
                    Xem tất cả <ChevronRight size={12} />
                  </button>
                </div>
                {recentLogs.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--text-muted))] m-0">Chưa có nhật ký nào.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentLogs.map(log => (
                      <button
                        key={log.id}
                        onClick={() => navigate(`/projects/${projectId}/logs?logId=${log.id}`)}
                        className="flex items-center gap-2.5 p-2.5 rounded-md bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))] text-left"
                      >
                        {log.images?.[0] && (
                          <img src={log.images[0]} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate text-[hsl(var(--text-primary))]">{log.taskName}</div>
                          <div className="text-[11px] text-[hsl(var(--text-muted))] truncate">{log.content}</div>
                        </div>
                        <span className="text-[11px] font-semibold text-[hsl(var(--success))] shrink-0">{log.progressTo}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {/* Task picker popup — khi có nhiều hơn 1 công việc đủ điều kiện để báo cáo */}
      <Modal isOpen={taskPickerOpen} onClose={() => setTaskPickerOpen(false)} title="Chọn công việc để báo cáo">
        <div className="flex flex-col gap-3">
          {creatableTasks.length > 5 && (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" />
              <Input
                type="text"
                placeholder="Tìm công việc theo tên..."
                value={taskPickerQuery}
                onChange={e => setTaskPickerQuery(e.target.value)}
                className="pl-9 h-10"
                autoFocus
              />
            </div>
          )}
          <div className="flex flex-col gap-2 max-h-[min(60vh,340px)] overflow-y-auto pr-0.5">
            {filteredCreatableTasks.length === 0 ? (
              <p className="text-sm text-[hsl(var(--text-muted))] m-0 py-2 text-center">Không tìm thấy công việc nào khớp.</p>
            ) : filteredCreatableTasks.map(task => (
            <button
              key={task.id}
              onClick={() => {
                setTaskPickerOpen(false);
                setLogModalTaskId(task.id);
              }}
              className="text-left p-3 rounded-md border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-glow))] transition-colors"
            >
              <div className="text-sm font-medium text-[hsl(var(--text-primary))]">{task.name}</div>
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <span className="text-[hsl(var(--text-muted))]">{task.progress}% hoàn thành</span>
                {isProjectWideView && (
                  <>
                    <span className="text-[hsl(var(--text-muted))]">&middot;</span>
                    <span className="text-[hsl(var(--text-muted))] truncate">{formatAssignees(task, user?.id)}</span>
                  </>
                )}
              </div>
            </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Daily log create modal */}
      {logModalTaskId && user && selectedProject && (
        <DailyLogFormModal
          isOpen={!!logModalTaskId}
          onClose={() => setLogModalTaskId(null)}
          taskId={logModalTaskId}
          tasks={tasks}
          engineerId={user.id}
          engineerName={user.name}
          canCreate={canCreateDailyLog(
            tasks.find(task => task.id === logModalTaskId),
            user,
            isProjectLeader,
            isProjectMember,
          )}
          isSiteEngineer={hasSiteEngineerRole(user)}
          canManageTechnical={canDecreaseDailyLogProgress}
          onSuccess={() => {
            setLogModalTaskId(null);
            if (projectId) loadProjectDetail(projectId, true);
          }}
        />
      )}
    </div>
  );
};
