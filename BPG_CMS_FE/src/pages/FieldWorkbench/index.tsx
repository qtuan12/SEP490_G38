import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Bell, Plus, FileText, ChevronRight, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { projectService } from '../../services/projectService';
import { DailyLogFormModal } from '../ProjectDailyLogs/modals/DailyLogFormModal';
import { Badge, LoadingSpinner, Select } from '../../components/ui';
import { getRoleLabel, getRoleBadgeVariant } from '../../utils/roleHelpers';
import { resolveNotificationUrl } from '../Notifications';
import type { Project, WBSTask, DailyLog } from '../../types/common';

const LAST_PROJECT_KEY = 'field_workbench_last_project';

export const FieldWorkbench: React.FC = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotification();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [logModalTaskId, setLogModalTaskId] = useState<string | null>(null);

  useEffect(() => {
    projectService.getProjects().then(list => {
      setProjects(list);
      const saved = localStorage.getItem(LAST_PROJECT_KEY);
      const initial = (saved && list.some(p => p.id === saved)) ? saved : (list[0]?.id || '');
      setProjectId(initial);
    }).catch(console.error).finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
    setLoadingDetail(true);
    Promise.all([
      projectService.getTasks(projectId),
      projectService.getDailyLogsPage(projectId, 1, 5),
    ]).then(([tasksData, logsResult]) => {
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
      setRecentLogs(logsResult.items);
    }).catch(console.error).finally(() => setLoadingDetail(false));
  }, [projectId]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    const assigned = tasks.filter(t => t.assignedTo?.split(',').map(s => s.trim()).includes(String(user.id)));
    if (assigned.length > 0) return assigned;
    // Fallback: no direct assignment found (e.g. TM/PL) — show closest existing data instead.
    return tasks.slice(0, 5);
  }, [tasks, user]);

  const recentNotifications = notifications.slice(0, 5);
  const selectedProject = projects.find(p => p.id === projectId);

  const handleNotificationClick = async (noti: any) => {
    if (!noti.isRead) await markAsRead(noti.notificationId);
    const url = resolveNotificationUrl(noti);
    if (url) navigate(url);
  };

  if (loadingProjects) {
    return <LoadingSpinner fullScreen />;
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

      {/* Project selector */}
      <div className="card p-3 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[hsl(var(--text-secondary))]">Dự án</label>
        {projects.length > 0 ? (
          <Select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            options={projects.map(p => ({ label: p.name, value: p.id }))}
            className="h-11"
          />
        ) : (
          <p className="text-sm text-[hsl(var(--text-muted))] m-0">Bạn chưa được gán vào dự án nào.</p>
        )}
      </div>

      {selectedProject && (
        <>
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setLogModalTaskId(myTasks[0]?.id || null)}
              disabled={myTasks.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-lg bg-[hsl(var(--primary))] text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title={myTasks.length === 0 ? 'Chưa có công việc để báo cáo' : undefined}
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
            <LoadingSpinner />
          ) : (
            <>
              {/* My tasks */}
              <section className="card p-3 flex flex-col gap-2">
                <h3 className="text-sm font-semibold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
                  <ClipboardList size={16} />
                  Việc của tôi
                </h3>
                {myTasks.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--text-muted))] m-0">Không có công việc nào trong dự án này.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {myTasks.map(task => (
                      <div key={task.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))]">
                        <button
                          onClick={() => navigate(`/tasks/${task.id.replace(/^t-/, '')}`)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="text-sm font-medium truncate text-[hsl(var(--text-primary))]">{task.name}</div>
                          <div className="text-xs text-[hsl(var(--text-muted))]">{task.progress}% hoàn thành</div>
                        </button>
                        <button
                          onClick={() => setLogModalTaskId(task.id)}
                          className="shrink-0 h-9 px-3 rounded-md bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] text-xs font-semibold"
                        >
                          + Nhật ký
                        </button>
                      </div>
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

      {/* Notifications */}
      <section className="card p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
            <Bell size={16} />
            Thông báo {unreadCount > 0 && <Badge variant="danger" className="text-[10px]">{unreadCount}</Badge>}
          </h3>
          <button
            onClick={() => navigate('/notifications')}
            className="text-xs font-medium text-[hsl(var(--primary))] flex items-center gap-0.5"
          >
            Xem tất cả <ChevronRight size={12} />
          </button>
        </div>
        {recentNotifications.length === 0 ? (
          <p className="text-xs text-[hsl(var(--text-muted))] m-0">Không có thông báo nào.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentNotifications.map(noti => (
              <button
                key={noti.notificationId}
                onClick={() => handleNotificationClick(noti)}
                className={`flex items-start gap-2 p-2.5 rounded-md border text-left ${noti.isRead ? 'bg-[hsl(var(--bg-main))] border-[hsl(var(--border))]' : 'bg-[hsl(var(--primary-glow))] border-[hsl(var(--primary)/0.3)]'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-[hsl(var(--text-primary))]">{noti.title}</div>
                  <div className="text-[11px] text-[hsl(var(--text-muted))] truncate">{noti.content}</div>
                </div>
                <ArrowRight size={13} className="shrink-0 mt-0.5 text-[hsl(var(--text-muted))]" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Daily log create modal */}
      {logModalTaskId && user && selectedProject && (
        <DailyLogFormModal
          isOpen={!!logModalTaskId}
          onClose={() => setLogModalTaskId(null)}
          taskId={logModalTaskId}
          tasks={tasks}
          engineerId={user.id}
          engineerName={user.name}
          onSuccess={() => setLogModalTaskId(null)}
        />
      )}
    </div>
  );
};
