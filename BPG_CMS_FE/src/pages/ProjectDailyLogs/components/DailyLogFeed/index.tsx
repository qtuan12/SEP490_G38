import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import { useNotification } from '../../../../context/NotificationContext';
import { projectService } from '../../../../services/projectService';
import { USE_MOCK_API } from '../../../../services/api';
import type { DailyLog, WBSTask, DailyLogComment, WBSPhase, TaskProgressLog } from '../../../../types/common';
import { Clock, Plus, ChevronDown, MessageSquare, AlertTriangle, History } from 'lucide-react';

import { Modal, Button, LoadingSpinner } from '../../../../components/ui';
import { DailyLogFormModal } from '../../modals/DailyLogFormModal';
import { DailyLogFilters } from './DailyLogFilters';
import { DailyLogCard } from './DailyLogCard';

import { useSearchParams } from 'react-router-dom';
import { useProjectAccess } from '../../../../hooks/useProjectAccess';
import { canCreateDailyLog, hasSiteEngineerRole } from '../../../../utils/taskPermissions';
import { RoleGroup } from '../../../../auth/roles';

const PAGE_SIZE = 4;

import { formatDateVietnam } from '../../../../utils/dateHelpers';

const formatDateTime = (dateStr?: string) => formatDateVietnam(dateStr || '');

const formatToLocalTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : (dateStr.includes('T') ? dateStr + 'Z' : dateStr.replace(' ', 'T') + 'Z');
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return dateStr;
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return dateStr.replace('T', ' ').slice(0, 16);
  }
};

const formatYYYYMMDDtoDDMMYYYY = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

interface DailyLogFeedProps {
  projectId: string;
  taskId?: string;
  onOpenProgressHistory?: () => void;
}

export const DailyLogFeed: React.FC<DailyLogFeedProps> = ({ projectId, taskId, onOpenProgressHistory }) => {
  const { user, hasAnyRole } = useAuth();
  const { canManageExecution, isProjectLeader, isProjectMember } = useProjectAccess(projectId);
  const canDecreaseDailyLogProgress = hasAnyRole(RoleGroup.Technical);
  const { connection } = useNotification();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [progressHistory, setProgressHistory] = useState<TaskProgressLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states for creating/editing Daily Logs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editLog, setEditLog] = useState<DailyLog | undefined>(undefined);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [selectedSubtaskId, setSelectedSubtaskId] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Image Zoom Modal State
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const currentTask = React.useMemo(() => {
    if (!taskId || !tasks || tasks.length === 0) return null;
    return tasks.find(t => String(t.id).replace(/^t-/, '') === String(taskId).replace(/^t-/, '')) || null;
  }, [taskId, tasks]);

  const currentTaskHasSubtasks = React.useMemo(() => {
    if (!currentTask) return false;
    return tasks.some(t => t.parentTaskId === currentTask.id && t.status !== 'obsolete');
  }, [currentTask, tasks]);

  const latestTaskDailyLog = React.useMemo(() => {
    if (!taskId || currentTaskHasSubtasks) return null;
    const normalizedTaskId = String(taskId).replace(/^t-/, '');
    return logs.find(log => String(log.taskId).replace(/^t-/, '') === normalizedTaskId) ?? null;
  }, [logs, taskId, currentTaskHasSubtasks]);

  const postLogDirectAdjustment = React.useMemo(() => {
    if (!currentTask || !latestTaskDailyLog || progressHistory.length === 0) return null;
    const latestChange = progressHistory[0];
    if (
      latestChange.source !== 'Direct'
      || latestChange.newProgress !== currentTask.progress
      || latestTaskDailyLog.progressTo === currentTask.progress
    ) {
      return null;
    }
    return latestChange;
  }, [currentTask, latestTaskDailyLog, progressHistory]);

  const descendantTasks = React.useMemo(() => {
    if (!taskId || !currentTask || !currentTaskHasSubtasks) return [];
    const list: WBSTask[] = [];
    const queue = [currentTask.id];
    while (queue.length > 0) {
      const parentId = queue.shift();
      const children = tasks.filter(t => t.parentTaskId === parentId && t.status !== 'obsolete');
      for (const child of children) {
        list.push(child);
        queue.push(child.id);
      }
    }
    return list;
  }, [taskId, currentTask, currentTaskHasSubtasks, tasks]);

  const [searchParams] = useSearchParams();
  const targetLogId = searchParams.get('logId');

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsResult, tasksData, phasesData, membersData, progressHistoryData] = await Promise.all([
        projectService.getDailyLogsPage(projectId, 1, PAGE_SIZE, taskId, targetLogId || undefined),
        projectService.getTasks(projectId),
        projectService.getPhases(projectId),
        projectService.getMembers(projectId),
        taskId
          ? projectService.getTaskProgressHistory(taskId)
          : Promise.resolve([] as TaskProgressLog[])
      ]);
      setLogs(logsResult.items);
      setHasNextPage(logsResult.items.length > 0 && logsResult.hasNextPage);
      setCurrentPage(1);
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
      setPhases(phasesData);
      setMembers(membersData || []);
      setProgressHistory(progressHistoryData);
    } catch (err: any) {
      console.error('Error loading daily logs data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const result = await projectService.getDailyLogsPage(projectId, nextPage, PAGE_SIZE, taskId);
      setLogs(prev => [...prev, ...result.items]);
      setHasNextPage(result.items.length > 0 && result.hasNextPage);
      setCurrentPage(nextPage);
    } catch (err: any) {
      console.error('Error loading more daily logs:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasNextPage, currentPage, projectId, taskId]);

  useEffect(() => {
    loadData();
  }, [projectId, taskId, targetLogId]);

  // Real-time synchronization using SignalR group for project
  useEffect(() => {
    if (USE_MOCK_API || !connection) return;

    const parsedProjectId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
    const numericProjectId = Number(parsedProjectId);
    if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) return;
    let active = true;

    const joinGroup = () => {
      if (!active || connection.state !== 'Connected') return;
      connection.invoke('JoinProjectGroup', numericProjectId)
        .then(() => console.log(`Joined SignalR project group: Project_${numericProjectId}`))
        .catch((err: any) => console.error('Error joining Project Group:', err));
    };

    joinGroup();
    connection.onreconnected(joinGroup);

    // Map helpers
    const mapRawComment = (c: any): DailyLogComment => ({
      id: c.commentId.toString(),
      userId: c.authorId.toString(),
      userName: c.authorName,
      role: c.authorRole,
      content: c.content,
      date: c.createdAt ? formatDateTime(c.createdAt) : ''
    });

    const mapRawDailyLog = (l: any): DailyLog => ({
      id: l.logId.toString(),
      projectId: projectId,
      taskId: l.taskId.toString(),
      taskName: l.taskName,
      engineerId: l.createdBy.toString(),
      engineerName: l.creatorName,
      progressFrom: l.oldProgressPercent,
      progressTo: l.newProgressPercent,
      date: l.createdAt ? formatToLocalTime(l.createdAt) : l.logDate,
      content: l.description,
      weather: '',
      images: l.images || [],
      comments: (l.comments || []).map(mapRawComment),
      canEdit: l.canEdit,
      editWindowHours: l.editWindowHours,
      isEdited: l.isEdited,
      lastEditedAt: l.lastEditedAt
    });

    // Event handlers
    const handleDailyLogCreated = (rawLog: any) => {
      console.log('SignalR: DailyLogCreated', rawLog);
      const mapped = mapRawDailyLog(rawLog);

      // Update logs list
      setLogs(prev => {
        if (prev.some(l => l.id === mapped.id)) return prev;

        const matchesTaskFilter = !taskId || mapped.taskId === taskId || mapped.taskId.replace(/^t-/, '') === taskId.replace(/^t-/, '');
        if (!matchesTaskFilter) return prev;

        return [mapped, ...prev];
      });

      // Update tasks list to reflect immediate progress change
      setTasks(prevTasks => prevTasks.map(t => {
        const matchesId = t.id === mapped.taskId || t.id.replace(/^t-/, '') === mapped.taskId.replace(/^t-/, '');
        if (matchesId) {
          return {
            ...t,
            progress: mapped.progressTo
          };
        }
        return t;
      }));

      // Reload tasks list in background to sync parent tasks averages properly
      projectService.getTasks(projectId)
        .then(tasksData => setTasks(tasksData.filter(t => t.status !== 'obsolete')))
        .catch(err => console.error('Error reloading tasks list in background:', err));
    };

    const handleDailyLogUpdated = (rawLog: any) => {
      console.log('SignalR: DailyLogUpdated', rawLog);
      const mapped = mapRawDailyLog(rawLog);
      setLogs(prev => prev.map(l => l.id === mapped.id ? {
        ...mapped,
        comments: mapped.comments && mapped.comments.length > 0 ? mapped.comments : l.comments
      } : l));
    };

    const handleCommentAdded = (rawComment: any) => {
      console.log('SignalR: CommentAdded', rawComment);
      const mapped = mapRawComment(rawComment);
      const logIdStr = rawComment.logId.toString();
      setLogs(prev => prev.map(l => {
        if (l.id !== logIdStr) return l;
        if (l.comments.some(c => c.id === mapped.id)) return l;
        return {
          ...l,
          comments: [...l.comments, mapped]
        };
      }));
    };

    const handleCommentUpdated = (rawComment: any) => {
      console.log('SignalR: CommentUpdated', rawComment);
      const mapped = mapRawComment(rawComment);
      const logIdStr = rawComment.logId.toString();
      setLogs(prev => prev.map(l => {
        if (l.id !== logIdStr) return l;
        return {
          ...l,
          comments: l.comments.map(c => c.id === mapped.id ? mapped : c)
        };
      }));
    };

    const handleCommentDeleted = (payload: { commentId: number, logId: number }) => {
      console.log('SignalR: CommentDeleted', payload);
      const commentIdStr = payload.commentId.toString();
      const logIdStr = payload.logId.toString();
      setLogs(prev => prev.map(l => {
        if (l.id !== logIdStr) return l;
        return {
          ...l,
          comments: l.comments.filter(c => c.id !== commentIdStr)
        };
      }));
    };

    // Register listeners
    connection.on('ReceiveDailyLogCreated', handleDailyLogCreated);
    connection.on('ReceiveDailyLogUpdated', handleDailyLogUpdated);
    connection.on('ReceiveCommentAdded', handleCommentAdded);
    connection.on('ReceiveCommentUpdated', handleCommentUpdated);
    connection.on('ReceiveCommentDeleted', handleCommentDeleted);

    return () => {
      active = false;
      // Unsubscribe
      connection.off('ReceiveDailyLogCreated', handleDailyLogCreated);
      connection.off('ReceiveDailyLogUpdated', handleDailyLogUpdated);
      connection.off('ReceiveCommentAdded', handleCommentAdded);
      connection.off('ReceiveCommentUpdated', handleCommentUpdated);
      connection.off('ReceiveCommentDeleted', handleCommentDeleted);

      // Leave Project group
      connection.invoke('LeaveProjectGroup', numericProjectId)
        .then(() => console.log(`Left SignalR project group: Project_${numericProjectId}`))
        .catch((err: any) => console.error('Error leaving Project Group:', err));
    };
  }, [connection, projectId, taskId]);

  const reloadLogs = async () => {
    try {
      const allItems: DailyLog[] = [];
      for (let p = 1; p <= currentPage; p++) {
        const result = await projectService.getDailyLogsPage(projectId, p, PAGE_SIZE, taskId);
        allItems.push(...result.items);
        if (!result.hasNextPage) {
          setHasNextPage(false);
          break;
        } else if (p === currentPage) {
          setHasNextPage(result.hasNextPage);
        }
      }
      setLogs(allItems);
    } catch (err: any) {
      console.error('Error reloading daily logs:', err);
    }
  };

  const assignedEngineers = React.useMemo(() => {
    const map = new Map<string, string>();

    if (taskId) {
      const targetTask = tasks.find(t => t.id === taskId || t.id.replace(/^t-/, '') === taskId.replace(/^t-/, ''));
      if (targetTask && targetTask.assignedTo && targetTask.assignedName) {
        const ids = targetTask.assignedTo.split(',').map(s => s.trim());
        const names = targetTask.assignedName.split(',').map(s => s.trim());
        ids.forEach((id, idx) => {
          if (id && names[idx]) {
            if (!USE_MOCK_API && id.startsWith('u-')) return;
            map.set(id, names[idx]);
          }
        });
      }
    } else if (selectedPhaseId) {
      const phaseTasks = tasks.filter(t => t.phaseId === selectedPhaseId || t.phaseId.replace(/^p-/, '') === selectedPhaseId.replace(/^p-/, ''));
      phaseTasks.forEach(t => {
        if (t.assignedTo && t.assignedName) {
          const ids = t.assignedTo.split(',').map(s => s.trim());
          const names = t.assignedName.split(',').map(s => s.trim());
          ids.forEach((id, idx) => {
            if (id && names[idx]) {
              if (!USE_MOCK_API && id.startsWith('u-')) return;
              map.set(id, names[idx]);
            }
          });
        }
      });
    } else {
      tasks.forEach(t => {
        if (t.assignedTo && t.assignedName) {
          const ids = t.assignedTo.split(',').map(s => s.trim());
          const names = t.assignedName.split(',').map(s => s.trim());
          ids.forEach((id, idx) => {
            if (id && names[idx]) {
              if (!USE_MOCK_API && id.startsWith('u-')) return;
              map.set(id, names[idx]);
            }
          });
        }
      });
    }

    logs.forEach(log => {
      let matchesTaskOrPhase = true;
      if (taskId) {
        matchesTaskOrPhase = log.taskId === taskId || log.taskId.replace(/^t-/, '') === taskId.replace(/^t-/, '');
      } else if (selectedPhaseId) {
        const logTask = tasks.find(t => t.id === log.taskId || t.id.replace(/^t-/, '') === log.taskId.replace(/^t-/, ''));
        matchesTaskOrPhase = !!logTask && (logTask.phaseId === selectedPhaseId || logTask.phaseId.replace(/^p-/, '') === selectedPhaseId.replace(/^p-/, ''));
      }
      if (matchesTaskOrPhase && log.engineerId && log.engineerName) {
        map.set(log.engineerId, log.engineerName);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks, logs, selectedPhaseId, taskId]);

  const phaseOptions = React.useMemo(() => {
    const options: { label: string; value: string }[] = [
      { label: 'Tất cả Giai đoạn', value: '' }
    ];
    phases.forEach(phase => {
      options.push({
        label: phase.name,
        value: phase.id
      });
    });
    return options;
  }, [phases]);

  useEffect(() => {
    if (selectedEngineerId) {
      const isAssigned = assignedEngineers.some(e => e.id === selectedEngineerId);
      if (!isAssigned) {
        setSelectedEngineerId('');
      }
    }
  }, [selectedPhaseId, taskId, assignedEngineers, selectedEngineerId]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        log.content.toLowerCase().includes(q) ||
        log.taskName.toLowerCase().includes(q) ||
        log.engineerName.toLowerCase().includes(q);

      let matchesTaskOrPhase = true;
      if (taskId) {
        if (selectedSubtaskId) {
          matchesTaskOrPhase = log.taskId === selectedSubtaskId || log.taskId.replace(/^t-/, '') === selectedSubtaskId.replace(/^t-/, '');
        } else {
          matchesTaskOrPhase = true;
        }
      } else if (selectedPhaseId) {
        const logTask = tasks.find(t => t.id === log.taskId || t.id.replace(/^t-/, '') === log.taskId.replace(/^t-/, ''));
        matchesTaskOrPhase = !!logTask && (logTask.phaseId === selectedPhaseId || logTask.phaseId.replace(/^p-/, '') === selectedPhaseId.replace(/^p-/, ''));
      }

      const matchesEngineer = !selectedEngineerId || log.engineerId === selectedEngineerId;
      const logDateOnly = log.date.split(' ')[0]; // YYYY-MM-DD
      const matchesStartDate = !startDateFilter || logDateOnly >= startDateFilter;
      const matchesEndDate = !endDateFilter || logDateOnly <= endDateFilter;

      return matchesSearch && matchesTaskOrPhase && matchesEngineer && matchesStartDate && matchesEndDate;
    });
  }, [logs, searchQuery, selectedPhaseId, selectedEngineerId, selectedSubtaskId, startDateFilter, endDateFilter, tasks, taskId]);

  const groupedLogs = React.useMemo(() => {
    const groups: Record<string, DailyLog[]> = {};
    filteredLogs.forEach(log => {
      const dateKey = log.date.split(' ')[0] || 'Chưa rõ ngày';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0])) // Ngày mới nhất ở trên
      .map(([date, items]) => ({ date, items }));
  }, [filteredLogs]);

  const formatDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const formatted = formatYYYYMMDDtoDDMMYYYY(dateStr);

    if (dateStr === today) return 'Hôm nay, ' + formatted;
    if (dateStr === yesterday) return 'Hôm qua, ' + formatted;
    return formatted;
  };

  const canReport = !!currentTask
    && canCreateDailyLog(currentTask, user, isProjectLeader, isProjectMember)
    && !currentTaskHasSubtasks
    && currentTask.status !== 'obsolete';

  return (
    <div className="flex flex-col gap-6 w-full mx-auto pb-10 text-left">
      <div className="border-b border-[hsl(var(--border))] pb-3 flex justify-between items-center flex-wrap gap-3">
        <div>
          <h3 className="text-[1.25rem] font-bold">Dòng thời gian Nhật ký Công trường</h3>
          <p className="text-[0.85rem] text-[hsl(var(--text-muted))] mt-1">
            Xem và theo dõi lịch sử cập nhật thi công của dự án theo trục thời gian thực tế.
          </p>
        </div>
        {canReport && (
          <Button
            variant="primary"
            onClick={() => {
              setEditLog(undefined);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Thêm Nhật ký</span>
          </Button>
        )}
      </div>

      {taskId && currentTask && !currentTaskHasSubtasks && (
        <div className={`flex items-start justify-between gap-3 px-4 py-3 rounded-md border ${postLogDirectAdjustment
          ? 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning-glow))]'
          : 'border-[hsl(var(--border))] bg-[hsl(var(--bg-card))]'}`}>
          <div className="flex items-start gap-2.5 min-w-0">
            {postLogDirectAdjustment
              ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[hsl(var(--warning))]" />
              : <History size={18} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" />}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                Tiến độ hiện tại: {currentTask.progress}%
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--text-secondary))]">
                {postLogDirectAdjustment
                  ? `Sau nhật ký gần nhất (${latestTaskDailyLog?.progressTo}%), Technical Manager đã điều chỉnh trực tiếp tiến độ thành ${currentTask.progress}%. Nhật ký gốc vẫn được giữ nguyên để bảo toàn dấu vết báo cáo.`
                  : 'Các tỷ lệ trên từng nhật ký là tiến độ được báo cáo tại thời điểm lập, có thể khác tiến độ hiện tại của công việc.'}
              </p>
            </div>
          </div>
          {onOpenProgressHistory && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenProgressHistory}
              className="shrink-0 flex items-center gap-1.5"
            >
              <History size={14} />
              <span>Xem lịch sử</span>
            </Button>
          )}
        </div>
      )}

      <DailyLogFilters
        taskId={taskId}
        currentTaskHasSubtasks={currentTaskHasSubtasks}
        descendantTasks={descendantTasks}
        phaseOptions={phaseOptions}
        assignedEngineers={assignedEngineers}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedPhaseId={selectedPhaseId}
        setSelectedPhaseId={setSelectedPhaseId}
        selectedSubtaskId={selectedSubtaskId}
        setSelectedSubtaskId={setSelectedSubtaskId}
        selectedEngineerId={selectedEngineerId}
        setSelectedEngineerId={setSelectedEngineerId}
        startDateFilter={startDateFilter}
        setStartDateFilter={setStartDateFilter}
        endDateFilter={endDateFilter}
        setEndDateFilter={setEndDateFilter}
      />

      {loading ? (
        <LoadingSpinner size="md" label="Đang tải dòng thời gian nhật ký thi công..." className="py-12" />
      ) : groupedLogs.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--text-muted))] border border-dashed border-[hsl(var(--border))] rounded-md">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
          <p>Không có nhật ký thi công nào khớp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="timeline-container">
          <div className="timeline-track" />

          {groupedLogs.map((group) => (
            <div key={group.date}>
              <div className="timeline-date-header">
                <Clock size={14} />
                <span>{formatDateLabel(group.date)}</span>
              </div>

              {group.items.map((log) => (
                <DailyLogCard
                  key={log.id}
                  log={log}
                  user={user}
          members={members}
          tasks={tasks}
          canManageExecution={canManageExecution}
                  onEditLog={(l) => {
                    setEditLog(l);
                    setIsModalOpen(true);
                  }}
                  onZoomImage={setZoomImage}
                  onReloadLogs={reloadLogs}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && hasNextPage && logs.length > 0 && filteredLogs.length > 0 && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className={`inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg border-2 border-solid border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] text-[hsl(var(--text-secondary))] font-semibold text-sm transition-all ${
              loadingMore ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'
            }`}
          >
            {loadingMore ? (
              <>
                <span className="animate-spin w-3.5 h-3.5 border-2 border-solid border-[hsl(var(--border))] border-t-[hsl(var(--primary))] rounded-full inline-block" />
                Đang tải...
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                Xem thêm nhật ký
              </>
            )}
          </button>
        </div>
      )}

      <Modal isOpen={!!zoomImage} onClose={() => setZoomImage(null)} title="Ảnh hiện trường thực tế">
        <div className="flex justify-center items-center overflow-hidden">
          {zoomImage && (
            <img
              src={zoomImage}
              alt="Zoomed"
              className="max-w-full max-h-[75vh] object-contain rounded-md"
            />
          )}
        </div>
      </Modal>

      {isModalOpen && user && (
        <DailyLogFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          tasks={tasks}
          phases={phases}
          taskId={taskId}
          selectedPhaseId={selectedPhaseId}
          editLog={editLog}
          engineerId={user.id}
          engineerName={user.name}
          canCreate={canReport}
          isSiteEngineer={hasSiteEngineerRole(user)}
          canManageTechnical={canDecreaseDailyLogProgress}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};
export default DailyLogFeed;
