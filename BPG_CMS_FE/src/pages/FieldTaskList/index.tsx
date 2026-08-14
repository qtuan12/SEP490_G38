import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectService } from '../../services/projectService';
import { DailyLogFormModal } from '../ProjectDailyLogs/modals/DailyLogFormModal';
import { LoadingSpinner, Input } from '../../components/ui';
import { TaskRow } from '../../components/field/TaskRow';
import { isProjectWideView as computeIsProjectWideView, canCreateDailyLog, getVisibleTasksForUser, hasSiteEngineerRole } from '../../utils/taskPermissions';
import { useProjectAccess } from '../../hooks/useProjectAccess';
import { RoleGroup } from '../../auth/roles';
import type { Project, WBSTask } from '../../types/common';
import { useRealtimeDataRefresh } from '../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../constants/realtimeEntities';

export const FieldTaskList: React.FC = () => {
  const { user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') || '';
  const { isProjectLeader, isProjectMember } = useProjectAccess(projectId);
  const canDecreaseDailyLogProgress = hasAnyRole(RoleGroup.Technical);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModalTaskId, setLogModalTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTasks = useCallback((pid: string) => {
    return projectService.getTasks(pid).then((tasksData) => {
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
    }).catch(console.error);
  }, []);

  useRealtimeDataRefresh(async () => {
    if (!projectId) return;
    try {
      const [projectData] = await Promise.all([
        projectService.getProjectById(projectId),
        loadTasks(projectId),
      ]);
      setProject(projectData);
    } catch (err) {
      console.error(err);
    }
  }, RealtimeEntities.projects);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      projectService.getProjectById(projectId),
      loadTasks(projectId),
    ]).then(([projectData]) => {
      setProject(projectData);
    }).catch(console.error).finally(() => setLoading(false));
  }, [projectId, loadTasks]);

  const isProjectWideView = computeIsProjectWideView(user, isProjectLeader);

  const myTasks = useMemo(
    () => getVisibleTasksForUser(tasks, user, isProjectWideView),
    [tasks, user, isProjectWideView]
  );

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return myTasks;
    return myTasks.filter(t => t.name.toLowerCase().includes(q));
  }, [myTasks, searchQuery]);

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-3 text-[hsl(var(--text-muted))]">
        <p>Không xác định được dự án.</p>
        <button onClick={() => navigate('/field')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium">
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto flex flex-col gap-4 animate-fade-in pb-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 self-start bg-transparent border-none text-[hsl(var(--text-secondary))] cursor-pointer text-sm font-medium hover:text-[hsl(var(--primary))]"
      >
        <ArrowLeft size={16} />
        <span>Quay lại</span>
      </button>

      <div>
        <h2 className="text-lg font-bold m-0 flex items-center gap-1.5 text-[hsl(var(--text-primary))]">
          <ClipboardList size={18} />
          {isProjectWideView ? 'Công việc dự án' : 'Việc của tôi'}
        </h2>
        {project && (
          <p className="text-xs text-[hsl(var(--text-muted))] m-0 mt-0.5">{project.name}</p>
        )}
      </div>

      {!loading && myTasks.length > 5 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))] pointer-events-none" />
          <Input
            type="text"
            placeholder="Tìm công việc theo tên..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-11"
          />
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : myTasks.length === 0 ? (
        <p className="text-sm text-[hsl(var(--text-muted))] m-0">
          {isProjectWideView ? 'Dự án chưa có công việc nào.' : 'Bạn chưa được gán công việc nào trong dự án này.'}
        </p>
      ) : filteredTasks.length === 0 ? (
        <p className="text-sm text-[hsl(var(--text-muted))] m-0">Không tìm thấy công việc nào khớp với "{searchQuery}".</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              currentUserId={user?.id}
              canCreateLog={canCreateDailyLog(task, user, isProjectLeader, isProjectMember)}
              showAssignee={isProjectWideView}
              onOpen={() => navigate(`/tasks/${task.id.replace(/^t-/, '')}`)}
              onCreateLog={() => setLogModalTaskId(task.id)}
            />
          ))}
        </div>
      )}

      {logModalTaskId && user && (
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
            loadTasks(projectId);
          }}
        />
      )}
    </div>
  );
};
