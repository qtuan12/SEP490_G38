import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { projectService } from '../services/projectService';
import { USE_MOCK_API } from '../services/api';
import type { DailyLog, WBSTask, DailyLogComment, WBSPhase } from '../types/common';
import {
  Clock,
  Send,
  MessageSquare,
  Eye,
  Search,
  CheckCircle,
  Plus,
  Edit2,
  Trash2,
  ChevronDown
} from 'lucide-react';

const PAGE_SIZE = 2;
import { Modal, Input, Select, Badge, Button } from './ui';
import type { BadgeVariant } from './ui';
import { DailyLogFormModal } from '../pages/Incidents/modals/DailyLogFormModal';

interface DailyLogFeedProps {
  projectId: string;
  taskId?: string;
}

export const DailyLogFeed: React.FC<DailyLogFeedProps> = ({ projectId, taskId }) => {
  const { user } = useAuth();
  const { connection } = useNotification();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states for creating/editing Daily Logs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editLog, setEditLog] = useState<DailyLog | undefined>(undefined);

  // States for comment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState<string>('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Acknowledged Comments State (Simulated on client-side via localStorage for simplicity)
  const [acknowledgedComments, setAcknowledgedComments] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bpg_acknowledged_comments') || '[]');
    } catch {
      return [];
    }
  });

  // Comment inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Image Zoom Modal State
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsResult, tasksData, phasesData, membersData] = await Promise.all([
        projectService.getDailyLogsPage(projectId, 1, PAGE_SIZE, taskId),
        projectService.getTasks(projectId),
        projectService.getPhases(projectId),
        projectService.getMembers(projectId)
      ]);
      setLogs(logsResult.items);
      setHasNextPage(logsResult.hasNextPage);
      setCurrentPage(1);
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
      setPhases(phasesData);
      setMembers(membersData || []);
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
      setHasNextPage(result.hasNextPage);
      setCurrentPage(nextPage);
    } catch (err: any) {
      console.error('Error loading more daily logs:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasNextPage, currentPage, projectId, taskId]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Real-time synchronization using SignalR group for project
  useEffect(() => {
    if (USE_MOCK_API || !connection) return;

    const parsedProjectId = projectId.startsWith('p-') ? projectId.substring(2) : projectId;
    const numericProjectId = Number(parsedProjectId);
    if (isNaN(numericProjectId)) return;

    // Join Project group
    connection.invoke('JoinProjectGroup', numericProjectId)
      .then(() => console.log(`Joined SignalR project group: Project_${numericProjectId}`))
      .catch((err: any) => console.error('Error joining Project Group:', err));

    // Map helpers
    const mapRawComment = (c: any): DailyLogComment => ({
      id: c.commentId.toString(),
      userId: c.authorId.toString(),
      userName: c.authorName,
      role: c.authorRole,
      content: c.content,
      date: c.createdAt ? c.createdAt.slice(0, 16).replace('T', ' ') : ''
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
      date: l.createdAt ? l.createdAt.slice(0, 16).replace('T', ' ') : l.logDate,
      content: l.description,
      weather: '',
      images: l.images || [],
      comments: (l.comments || []).map(mapRawComment)
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
    // After a mutation (comment add/edit/delete or log edit), reload the current
    // visible window by fetching pages 1..currentPage so we don't lose items the
    // user already scrolled through.
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

  const handleCommentChange = (logId: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [logId]: value }));
  };

  const handleCommentSubmit = async (e: React.FormEvent, logId: string) => {
    e.preventDefault();
    if (!user) return;

    const content = commentInputs[logId]?.trim();
    if (!content) return;

    try {
      await projectService.addLogComment(logId, {
        id: user.id,
        name: user.name,
        role: user.role
      }, content);

      // Clear input
      setCommentInputs(prev => ({ ...prev, [logId]: '' }));

      // Reload to show updated comments
      await reloadLogs();
    } catch (err: any) {
      alert(err.message || 'Không thể gửi bình luận.');
    }
  };

  const handleCommentUpdateSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    const content = editingCommentContent.trim();
    if (!content) return;

    try {
      await projectService.updateLogComment(commentId, content);
      setEditingCommentId(null);

      // Reload comments
      await reloadLogs();
    } catch (err: any) {
      alert(err.message || 'Không thể cập nhật bình luận.');
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) return;
    try {
      const success = await projectService.deleteLogComment(commentId);
      if (success) {
        // Reload comments
        await reloadLogs();
      }
    } catch (err: any) {
      alert(err.message || 'Không thể xóa bình luận.');
    }
  };

  const handleAcknowledgeComment = (commentId: string) => {
    const updated = [...acknowledgedComments, commentId];
    setAcknowledgedComments(updated);
    localStorage.setItem('bpg_acknowledged_comments', JSON.stringify(updated));
  };



  // Extract engineers assigned to the selected task or phase
  const assignedEngineers = React.useMemo(() => {
    const map = new Map<string, string>();

    // 1. Gather from task assignments
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

    // 2. Gather from actual authors of daily logs
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

  // Reset selected engineer if they are not in the assigned list of the newly selected phase/task
  useEffect(() => {
    if (selectedEngineerId) {
      const isAssigned = assignedEngineers.some(e => e.id === selectedEngineerId);
      if (!isAssigned) {
        setSelectedEngineerId('');
      }
    }
  }, [selectedPhaseId, taskId, assignedEngineers, selectedEngineerId]);

  // Apply filters in memory
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query (check content, engineerName, taskName)
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        log.content.toLowerCase().includes(q) ||
        log.taskName.toLowerCase().includes(q) ||
        log.engineerName.toLowerCase().includes(q);

      // 2. Task / Phase filter
      let matchesTaskOrPhase = true;
      if (taskId) {
        matchesTaskOrPhase = log.taskId === taskId || log.taskId.replace(/^t-/, '') === taskId.replace(/^t-/, '');
      } else if (selectedPhaseId) {
        const logTask = tasks.find(t => t.id === log.taskId || t.id.replace(/^t-/, '') === log.taskId.replace(/^t-/, ''));
        matchesTaskOrPhase = !!logTask && (logTask.phaseId === selectedPhaseId || logTask.phaseId.replace(/^p-/, '') === selectedPhaseId.replace(/^p-/, ''));
      }

      // 3. Engineer filter
      const matchesEngineer = !selectedEngineerId || log.engineerId === selectedEngineerId;

      // 4. Date Range filters
      const logDateOnly = log.date.split(' ')[0]; // YYYY-MM-DD
      const matchesStartDate = !startDateFilter || logDateOnly >= startDateFilter;
      const matchesEndDate = !endDateFilter || logDateOnly <= endDateFilter;

      return matchesSearch && matchesTaskOrPhase && matchesEngineer && matchesStartDate && matchesEndDate;
    });
  }, [logs, searchQuery, selectedPhaseId, selectedEngineerId, startDateFilter, endDateFilter, tasks, taskId]);

  // Group logs by date (YYYY-MM-DD)
  const groupedLogs = React.useMemo(() => {
    const groups: Record<string, DailyLog[]> = {};
    filteredLogs.forEach(log => {
      // Date is format "YYYY-MM-DD HH:MM", extract YYYY-MM-DD
      const dateKey = log.date.split(' ')[0] || 'Chưa rõ ngày';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0])) // newer dates first
      .map(([date, items]) => ({ date, items }));
  }, [filteredLogs]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'technicalmanager': return 'TP Kỹ Thuật';
      case 'siteengineer': return 'Kỹ Sư Hiện Trường';
      case 'projectleader': return 'Trưởng Dự Án';
      case 'director': return 'Giám Đốc';
      case 'accountant': return 'Kế Toán';
      default: return role;
    }
  };

  const getRoleBadgeVariant = (role: string): BadgeVariant => {
    switch (role) {
      case 'admin': return 'danger';
      case 'technicalmanager': return 'default';
      case 'siteengineer': return 'success';
      case 'projectleader': return 'warning';
      case 'director': return 'warning';
      case 'accountant': return 'default';
      default: return 'default';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateStr === today) {
      return 'Hôm nay, ' + dateStr;
    } else if (dateStr === yesterday) {
      return 'Hôm qua, ' + dateStr;
    }
    return dateStr;
  };

  const isPL = members.some(m => m.userId === user?.id && m.isLeader) || user?.role === 'technicalmanager' || user?.role === 'admin';
  const hasAnyAssignedTask = tasks.some(t => {
    if (taskId && String(t.id).replace(/^t-/, '') !== String(taskId).replace(/^t-/, '')) {
      return false;
    }
    const assignedIds = t.assignedTo ? t.assignedTo.split(',').map(s => s.trim()) : [];
    return user?.id && assignedIds.includes(user.id.toString());
  });
  const canReport = isPL || hasAnyAssignedTask;

  return (
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto pb-10">

      {/* Title & Header */}
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

      {/* Stats Dashboard Removed */}

      {/* 2. FILTER & SEARCH BAR */}
      <div className="card p-4 sm:p-5 flex flex-col gap-3 bg-[hsl(var(--bg-card))]">
        <div className="flex gap-3 flex-wrap items-center">

          {/* Text Search */}
          <div className="flex-[2] min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
            <Input
              type="text"
              placeholder="Tìm nội dung, công việc, kỹ sư..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-[38px]"
            />
          </div>

          {/* Phase Dropdown */}
          {!taskId && (
            <div className="flex-1 min-w-[150px]">
              <Select
                value={selectedPhaseId}
                onChange={(e) => setSelectedPhaseId(e.target.value)}
                className="h-[38px] text-[0.85rem]"
                options={phaseOptions}
              />
            </div>
          )}

          {/* Engineer Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <Select
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              className="h-[38px] text-[0.85rem]"
              options={[
                { label: 'Tất cả Kỹ sư', value: '' },
                ...assignedEngineers.map(e => ({ label: e.name, value: e.id }))
              ]}
            />
          </div>

        </div>

        {/* Date range filters */}
        <div className="flex gap-3 flex-wrap items-center text-[0.85rem] text-[hsl(var(--text-secondary))] border-t border-[hsl(var(--border)/0.5)] pt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Từ ngày:</span>
            <Input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="h-[32px] text-xs py-1"
              style={{ width: '135px' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 whitespace-nowrap">Đến ngày:</span>
            <Input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="h-[32px] text-xs py-1"
              style={{ width: '135px' }}
            />
          </div>
          {(startDateFilter || endDateFilter) && (
            <button
              type="button"
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Xóa bộ lọc ngày
            </button>
          )}
        </div>
      </div>

      {/* 3. TIMELINE LIST */}
      {loading ? (
        <div className="text-center py-10 text-[hsl(var(--text-muted))]">
          Đang tải dòng thời gian...
        </div>
      ) : groupedLogs.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--text-muted))] border border-dashed border-[hsl(var(--border))] rounded-md">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
          <p>Không có nhật ký thi công nào khớp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="timeline-container">

          {/* Vertical Track Line */}
          <div className="timeline-track" />

          {/* Grouped Logs by Date */}
          {groupedLogs.map((group) => (
            <div key={group.date}>

              {/* Date Header */}
              <div className="timeline-date-header">
                <Clock size={14} />
                <span>{formatDateLabel(group.date)}</span>
              </div>

              {/* Items for this date */}
              {group.items.map((log) => {
                const isIncident = log.progressTo < log.progressFrom;
                const delta = log.progressTo - log.progressFrom;

                // Determine node color type
                let nodeClass = "timeline-node-info";
                if (isIncident) {
                  nodeClass = "timeline-node-danger";
                } else if (delta > 0) {
                  nodeClass = "timeline-node-success";
                }

                const isPL = members.some(m => m.userId === user?.id && m.isLeader) || user?.role === 'technicalmanager' || user?.role === 'admin';
                const logTask = tasks.find(t => String(t.id).replace(/^t-/, '') === String(log.taskId).replace(/^t-/, ''));
                const assignedIds = logTask?.assignedTo ? logTask.assignedTo.split(',').map(s => s.trim()) : [];
                const isAssigned = user?.id && assignedIds.includes(user.id.toString());
                const canEditLog = isPL || isAssigned;

                return (
                  <div key={log.id} className="timeline-item animate-fade-in">

                    {/* Circle Node on Timeline Track */}
                    <div className={`timeline-node ${nodeClass}`} />

                    {/* Main Log Card */}
                    <div
                      className="card flex flex-col gap-3.5 bg-[hsl(var(--bg-card))]"
                      style={{
                        padding: '20px',
                        border: isIncident ? '1.5px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--border))',
                        boxShadow: isIncident ? '0 4px 12px hsl(var(--danger-glow))' : 'var(--shadow-sm)'
                      }}
                    >
                      {/* Log Header */}
                      <div className="flex justify-between items-start flex-wrap gap-3">
                        <div className="flex gap-2.5 items-center">
                          <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[0.85rem] shrink-0 ${isIncident ? 'bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]'}`}>
                            {log.engineerName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-[0.9rem]">{log.engineerName}</strong>
                              {(() => {
                                const mInfo = members.find(m => String(m.userId) === String(log.engineerId));
                                let cRole = mInfo ? mInfo.role : '';
                                if (!cRole) {
                                  if (String(user?.id) === String(log.engineerId)) {
                                    cRole = user?.role || '';
                                  } else {
                                    if (log.engineerName.toLowerCase().includes('tuan') || log.engineerName.toLowerCase().includes('tpkt')) {
                                      cRole = 'technicalmanager';
                                    } else if (log.engineerName.toLowerCase().includes('admin')) {
                                      cRole = 'admin';
                                    } else {
                                      cRole = 'siteengineer';
                                    }
                                  }
                                }
                                return (
                                  <Badge variant={getRoleBadgeVariant(cRole)} className="text-[0.6rem] normal-case py-0.5 px-1.5 h-auto">
                                    {getRoleLabel(cRole)}
                                  </Badge>
                                );
                              })()}
                              {canEditLog && (
                                <button
                                  onClick={() => {
                                    setEditLog(log);
                                    setIsModalOpen(true);
                                  }}
                                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                  title="Sửa nhật ký"
                                >
                                  <Edit2 size={13} />
                                </button>
                              )}
                            </div>
                            <span className="text-[0.7rem] text-[hsl(var(--text-muted))] flex items-center gap-1 mt-0.5">
                              <Clock size={11} />
                              {log.date.split(' ')[1] || ''}
                            </span>
                          </div>
                        </div>

                        {/* Progress changes */}
                        <div className="text-right">
                          <span className="text-[0.7rem] text-[hsl(var(--text-muted))] font-medium">Thay đổi tiến độ</span>
                          <div className={`font-extrabold text-base flex items-center justify-end gap-1 ${isIncident ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                            <span>{log.progressFrom}%</span>
                            <span>&rarr;</span>
                            <span>{log.progressTo}%</span>
                            <span className="text-xs font-bold">
                              ({delta > 0 ? `+${delta}%` : `${delta}%`})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Task Info Row */}
                      <div className={`bg-[hsl(var(--bg-main))] px-3 py-2 rounded-sm text-sm font-medium flex items-center justify-between border-l-4 ${isIncident ? 'border-[hsl(var(--danger))]' : 'border-[hsl(var(--primary))]'}`}>
                        <span>Công việc: <strong className="text-[hsl(var(--text-primary))]">{log.taskName}</strong></span>
                      </div>

                      {/* Content Text */}
                      <p className="text-[0.9rem] text-[hsl(var(--text-primary))] leading-relaxed whitespace-pre-wrap m-0">
                        {log.content}
                      </p>

                      {/* Images Grid */}
                      {log.images && log.images.length > 0 && (
                        <div className={`grid gap-2 mt-1 ${log.images.length === 1 ? 'grid-cols-1' : log.images.length === 2 ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))]'}`}>
                          {log.images.map((img, index) => (
                            <div
                              key={index}
                              className={`rounded-md overflow-hidden relative border border-[hsl(var(--border))] cursor-zoom-in group ${log.images?.length === 1 ? 'h-[240px]' : 'h-[120px]'}`}
                              onClick={() => setZoomImage(img)}
                            >
                              <img
                                src={img}
                                alt={`Hiện trường ${index + 1}`}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white p-1 rounded-full flex items-center justify-center">
                                <Eye size={10} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-1.5 border-t border-[hsl(var(--border)/0.5)] pt-3">
                        <h4 className="text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2 flex items-center gap-1.5">
                          <MessageSquare size={13} />
                          <span>Ý kiến Chỉ đạo & Bình luận ({log.comments?.length || 0})</span>
                        </h4>

                        {(log.comments?.length || 0) > 0 && (
                          <div className="flex flex-col gap-2 mb-3">
                            {log.comments?.map((comm) => {
                              const isManager = comm.role === 'technicalmanager' || comm.role === 'director';
                              const isAcknowledged = acknowledgedComments.includes(comm.id);

                              let commentClass = "";
                              if (isManager) {
                                commentClass = "comment-highlight-manager";
                              }
                              if (isAcknowledged) {
                                commentClass += " comment-acknowledged";
                              }

                              const canEditComment = comm.userId === user?.id || user?.role === 'technicalmanager' || user?.role === 'admin';

                              return (
                                <div
                                  key={comm.id}
                                  className={`flex gap-2.5 px-3 py-2 bg-[hsl(var(--bg-main)/0.4)] rounded-sm text-[0.825rem] border border-[hsl(var(--border)/0.5)] transition-all duration-200 ${commentClass}`}
                                >
                                  <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold text-[0.75rem] shrink-0 ${isManager ? 'bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))]' : 'bg-[hsl(var(--border))] text-[hsl(var(--text-primary))]'}`}>
                                    {comm.userName.charAt(0)}
                                  </div>

                                  <div className="flex flex-col gap-0.5 flex-1">
                                    <div className="flex justify-between flex-wrap items-center">
                                      <span>
                                        <strong className="mr-1.5">{comm.userName}</strong>
                                        <Badge variant={getRoleBadgeVariant(comm.role)} className="text-[0.5rem] py-0 px-1 normal-case leading-tight h-auto">
                                          {getRoleLabel(comm.role)}
                                        </Badge>
                                      </span>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[0.65rem] text-[hsl(var(--text-muted))]">{comm.date}</span>
                                        {canEditComment && editingCommentId !== comm.id && (
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => {
                                                setEditingCommentId(comm.id);
                                                setEditingCommentContent(comm.content);
                                              }}
                                              className="text-slate-400 hover:text-blue-600 transition-colors"
                                              title="Sửa bình luận"
                                            >
                                              <Edit2 size={11} />
                                            </button>
                                            <button
                                              onClick={() => handleCommentDelete(comm.id)}
                                              className="text-slate-400 hover:text-red-600 transition-colors"
                                              title="Xóa bình luận"
                                            >
                                              <Trash2 size={11} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {editingCommentId === comm.id ? (
                                      <form
                                        onSubmit={(e) => handleCommentUpdateSubmit(e, comm.id)}
                                        className="flex gap-2 mt-1.5 w-full"
                                      >
                                        <Input
                                          type="text"
                                          value={editingCommentContent}
                                          onChange={(e) => setEditingCommentContent(e.target.value)}
                                          className="h-8 text-xs flex-1"
                                          required
                                          autoFocus
                                        />
                                        <Button size="sm" type="submit" variant="primary" className="h-8 px-2 py-0.5 text-xs">Lưu</Button>
                                        <Button size="sm" type="button" variant="outline" className="h-8 px-2 py-0.5 text-xs" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                                      </form>
                                    ) : (
                                      <p className="text-[hsl(var(--text-primary))] mt-0.5 leading-snug">
                                        {comm.content}
                                      </p>
                                    )}

                                    {isManager && !isAcknowledged && (() => {
                                      const logTask = tasks.find(t => String(t.id).replace(/^t-/, '') === String(log.taskId).replace(/^t-/, ''));
                                      const assignedIds = logTask?.assignedTo ? logTask.assignedTo.split(',').map(s => s.trim()) : [];
                                      return user?.id && assignedIds.includes(user.id.toString());
                                    })() && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleAcknowledgeComment(comm.id)}
                                        className="self-start py-0.5 px-1.5 text-[0.65rem] mt-1.5 h-auto flex items-center gap-1 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))]"
                                      >
                                        <CheckCircle size={10} />
                                        <span>Xác nhận đã đọc chỉ đạo</span>
                                      </Button>
                                    )}

                                    {isManager && isAcknowledged && (
                                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--success))] font-semibold mt-1">
                                        <CheckCircle size={10} />
                                        <span>Đã ghi nhận chỉ đạo</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {user && (members.some(m => m.userId === user?.id) || user?.role === 'technicalmanager' || user?.role === 'admin') && (
                          <form onSubmit={(e) => handleCommentSubmit(e, log.id)} className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Nhập ý kiến chỉ đạo trực tuyến của Ban lãnh đạo..."
                              value={commentInputs[log.id] || ''}
                              onChange={(e) => handleCommentChange(log.id, e.target.value)}
                              className="h-9 text-xs flex-1"
                              required
                            />
                            <Button
                              type="submit"
                              variant="primary"
                              className="w-9 h-9 p-0 rounded-sm shrink-0 flex items-center justify-center"
                            >
                              <Send size={13} />
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* LOAD MORE BUTTON */}
      {!loading && hasNextPage && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 24px',
              borderRadius: '8px',
              border: '1.5px solid hsl(var(--border))',
              background: 'hsl(var(--bg-card))',
              color: 'hsl(var(--text-secondary))',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
              opacity: loadingMore ? 0.6 : 1,
              transition: 'all 0.15s ease'
            }}
          >
            {loadingMore ? (
              <>
                <span
                  className="animate-spin"
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid hsl(var(--border))',
                    borderTopColor: 'hsl(var(--primary))',
                    borderRadius: '50%',
                    display: 'inline-block'
                  }}
                />
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

      {/* IMAGE ZOOM MODAL */}
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

      {/* INTEGRATED FORM MODAL */}
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
          isPL={members.some(m => m.userId === user?.id && m.isLeader) || user?.role === 'technicalmanager' || user?.role === 'admin'}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

    </div>
  );
};
