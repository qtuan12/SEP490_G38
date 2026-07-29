import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project } from '../types/common';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  TrendingUp,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProjectAccess } from '../hooks/useProjectAccess';

import { DailyLogFormModal } from './ProjectDailyLogs/modals/DailyLogFormModal';

// ── helpers ───────────────────────────────────────────────────────────────
const formatDate = (s: string) => {
  if (!s) return '';
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return s;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

type ViewMode = 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month';
const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Ngày', value: 'Day' },
  { label: 'Tuần', value: 'Week' },
  { label: 'Tháng', value: 'Month' },
];

// ── component ────────────────────────────────────────────────────────────
interface Props {
  embeddedProjectId?: string;
}

export const GanttChart: React.FC<Props> = ({ embeddedProjectId }) => {
  const params = useParams<{ projectId: string }>();
  const projectId = embeddedProjectId || params.projectId;
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Week');
  const [showGrid, setShowGrid] = useState(true);

  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { canManageExecution, canManageTechnical } = useProjectAccess(projectId);

  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedTaskToAdjust, setSelectedTaskToAdjust] = useState<WBSTask | null>(null);

  // ── load data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [projs, pList, tList] = await Promise.all([
          projectService.getProjects(),
          projectService.getPhases(projectId),
          projectService.getTasks(projectId)
        ]);
        setProject(projs.find(p => p.id === projectId) ?? null);
        setPhases(pList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        setTasks(
          tList
            .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? i + 1 }))
            .sort((a, b) => a.sortOrder - b.sortOrder)
        );
      } catch (e: any) {
        setError(e.message ?? 'Lỗi tải dữ liệu.');
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  // ── build DHTMLX data ────────────────────────────────────────────────
  const buildDhtmlxData = useCallback(() => {
    const data: any[] = [];
    const links: any[] = [];

    const projStart = project?.startDate ? new Date(project.startDate) : new Date();

    phases.forEach((ph, index) => {
      const phaseTasks = tasks.filter(t => t.phaseId === ph.id);
      const activePhaseTasks = phaseTasks.filter(t => t.status !== 'obsolete');
      const progress = activePhaseTasks.length
        ? Math.round(activePhaseTasks.reduce((s, t) => s + t.progress, 0) / Math.max(1, activePhaseTasks.length)) / 100
        : 0;

      let minDate: Date;
      let maxDate: Date;

      if (phaseTasks.length > 0) {
        minDate = new Date(Math.min(...phaseTasks.map(t => new Date(t.startDate || t.deadline).getTime())));
        maxDate = new Date(Math.max(...phaseTasks.map(t => new Date(t.deadline).getTime())));
      } else {
        minDate = ph.startDate ? new Date(ph.startDate) : new Date(projStart.getTime() + index * 7 * 24 * 60 * 60 * 1000);
        maxDate = ph.endDate ? new Date(ph.endDate) : new Date(minDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      }

      if (maxDate.getTime() <= minDate.getTime()) {
        maxDate = new Date(minDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      }

      data.push({
        id: `phase_${ph.id}`,
        text: `📁 ${ph.name}`,
        start_date: minDate,
        end_date: maxDate,
        type: gantt.config.types.project,
        progress: progress,
        open: true,
        custom_class: ph.status === 'frozen' ? 'gantt-phase-frozen' : 'gantt-phase',
      });
    });

    tasks.forEach(t => {
      let customClass = 'gantt-task';
      if (t.status === 'obsolete') customClass = 'gantt-task-obsolete';
      else if (t.isOverdue) customClass = 'gantt-task-delayed';
      else if (t.progress === 100) customClass = 'gantt-task-done';
      else if (t.progress > 0) customClass = 'gantt-task-inprogress';

      const tStart = new Date(t.startDate || t.deadline);
      let tEnd = new Date(t.deadline);
      if (tEnd.getTime() <= tStart.getTime()) {
        tEnd = new Date(tStart.getTime() + 24 * 60 * 60 * 1000);
      }

      data.push({
        id: t.id,
        text: t.name,
        start_date: tStart,
        end_date: tEnd,
        type: gantt.config.types.task,
        progress: t.progress / 100,
        parent: `phase_${t.phaseId}`,
        custom_class: customClass,
        status: t.status,
        assignedName: t.assignedName,
        rawTask: t,
      });

      // 1. Explicit predecessorTaskIds dependencies
      if (t.predecessorTaskIds && t.predecessorTaskIds.length > 0) {
        t.predecessorTaskIds.forEach(predId => {
          const predTask = tasks.find(x => String(x.id).replace(/^t-/, '') === String(predId).replace(/^t-/, ''));
          if (predTask) {
            links.push({
              id: `link_${predTask.id}_${t.id}`,
              source: predTask.id.toString(),
              target: t.id.toString(),
              type: '0', // finish_to_start
            });
          }
        });
      }
    });

    // 2. Sequential links between adjacent tasks within the same phase
    phases.forEach(ph => {
      const phaseTasks = tasks.filter(t => t.phaseId === ph.id && t.status !== 'obsolete');
      for (let i = 1; i < phaseTasks.length; i++) {
        const prev = phaseTasks[i - 1];
        const curr = phaseTasks[i];
        if (!curr.predecessorTaskIds || curr.predecessorTaskIds.length === 0) {
          links.push({
            id: `link_seq_${prev.id}_${curr.id}`,
            source: prev.id.toString(),
            target: curr.id.toString(),
            type: '0', // finish_to_start
          });
        }
      }
    });

    // 3. Sequential link from last task of phase i-1 to first task of phase i
    for (let i = 1; i < phases.length; i++) {
      const prevTasks = tasks.filter(t => t.phaseId === phases[i - 1].id && t.status !== 'obsolete');
      const currTasks = tasks.filter(t => t.phaseId === phases[i].id && t.status !== 'obsolete');
      if (prevTasks.length > 0 && currTasks.length > 0) {
        const lastTask = prevTasks[prevTasks.length - 1];
        const firstTask = currTasks[0];
        links.push({
          id: `link_phase_seq_${lastTask.id}_${firstTask.id}`,
          source: lastTask.id.toString(),
          target: firstTask.id.toString(),
          type: '0',
        });
      }
    }

    return { data, links };
  }, [phases, tasks, project]);

  // ── configure Gantt & Events ──────────────────────────────────────────
  useEffect(() => {
    if (loading || !ganttContainerRef.current) return;

    // config basic Gantt Settings
    gantt.config.readonly = true;
    gantt.config.show_links = true;
    gantt.config.link_wrapper_width = 20;
    gantt.config.link_line_width = 2;
    gantt.config.columns = [
      {
        name: "text",
        label: "Tên công việc",
        width: "*",
        tree: true,
        template: (obj: any) => {
          if (obj.rawTask?.status === 'obsolete' || obj.status === 'obsolete' || obj.custom_class?.includes('obsolete')) {
            return `<span style="color: #94a3b8; font-weight: 500;">
              <span style="background-color: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 700; padding: 1.5px 5px; border-radius: 4px; margin-right: 5px; display: inline-block; border: 1px solid #fca5a5;">⛔ Đã dừng</span>
              <span style="text-decoration: line-through;">${obj.text}</span>
            </span>`;
          }
          return obj.text;
        }
      },
      {
        name: "start_date",
        label: "Bắt đầu",
        align: "center",
        width: 80,
        template: (obj: any) => formatDate(obj.start_date.toISOString().split('T')[0])
      },
      {
        name: "progress",
        label: "Tiến độ",
        align: "center",
        width: 70,
        template: (obj: any) => {
          if (obj.rawTask?.status === 'obsolete' || obj.status === 'obsolete' || obj.custom_class?.includes('obsolete')) {
            return `<span style="color: #ef4444; font-size: 11px; font-weight: 700;">Đã dừng</span>`;
          }
          return `${Math.round(obj.progress * 100)}%`;
        }
      },
    ];

    // Config tooltips & resource text
    gantt.templates.rightside_text = function (_start: any, _end: any, task: any) {
      if (task.type === gantt.config.types.project) return "";
      if (task.rawTask?.status === 'obsolete' || task.status === 'obsolete' || task.custom_class?.includes('obsolete')) {
        const reason = task.rawTask?.obsoleteReason ? `: ${task.rawTask.obsoleteReason}` : '';
        return `<span style="color: #ef4444; font-size: 11px; font-weight: 700; margin-left: 8px;">⛔ Đã dừng${reason}</span>`;
      }
      return task.assignedName ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">👤 ${task.assignedName}</span>` : "";
    };

    // Initialize Gantt
    gantt.init(ganttContainerRef.current);
    gantt.clearAll();

    const ganttData = buildDhtmlxData();
    gantt.parse(ganttData);

    const clickEventId = gantt.attachEvent("onTaskClick", function (id: string | number) {
      const taskObj = gantt.getTask(id);
      if (taskObj.type !== gantt.config.types.project && taskObj.rawTask) {
        const wbsTask = taskObj.rawTask as WBSTask;
        const currentTaskHasSubtasks = tasks.some(t => t.parentTaskId === wbsTask.id && t.status !== 'obsolete');
        const assignedIds = wbsTask.assignedTo ? wbsTask.assignedTo.split(',').map(s => s.trim()) : [];
        const hasAnyAssignedTask = user?.id && assignedIds.includes(user.id.toString());

        const canReport = (canManageExecution || hasAnyAssignedTask) && !currentTaskHasSubtasks && wbsTask.status !== 'obsolete';

        if (canReport) {
          setSelectedTaskToAdjust(wbsTask);
          setAdjustModalOpen(true);
        }
      }
      return true;
    });

    return () => {
      gantt.detachEvent(clickEventId);
      gantt.clearAll();
    };
  }, [loading, phases, tasks, buildDhtmlxData, user, canManageExecution]);

  // ── change view mode ──────────────────────────────────────────────────
  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  useEffect(() => {
    if (loading || !ganttContainerRef.current) return;

    gantt.config.show_grid = showGrid;

    if (viewMode === 'Day') {
      gantt.config.scale_unit = "day";
      gantt.config.min_column_width = 40;
      gantt.config.scales = [
        { unit: "month", step: 1, format: "Tháng %m, %Y" },
        { unit: "day", step: 1, format: "%d" }
      ];
    } else if (viewMode === 'Week') {
      gantt.config.min_column_width = 50;
      gantt.config.scales = [
        { unit: "week", step: 1, format: "Tuần %W" },
        { unit: "day", step: 1, format: "%d/%m" }
      ];
    } else if (viewMode === 'Month') {
      gantt.config.min_column_width = 70;
      gantt.config.scales = [
        { unit: "year", step: 1, format: "%Y" },
        { unit: "month", step: 1, format: "Tháng %m" }
      ];
    }
    gantt.render();
  }, [viewMode, loading, showGrid]);

  // ── summary stats ─────────────────────────────────────────────────────
  const activeTasks = tasks.filter(t => t.status !== 'obsolete');
  const doneTasks = activeTasks.filter(t => t.progress === 100);
  const inProgressTasks = activeTasks.filter(t => t.progress > 0 && t.progress < 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-[hsl(var(--text-muted))]">
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Gantt Chart...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center text-[hsl(var(--danger))]">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          {!embeddedProjectId && (
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="flex items-center gap-1.5 py-1.5 px-3.5 border border-[hsl(var(--border))] rounded-sm bg-transparent cursor-pointer text-[hsl(var(--text-secondary))] text-[0.85rem] font-medium hover:bg-[hsl(var(--bg-main))] transition-colors"
            >
              <ArrowLeft size={15} /><span>Quay lại</span>
            </button>
          )}
          <div>
            <h2 className="text-[1.1rem] font-bold m-0">
              Biểu đồ công việc — {project?.name ?? ''}
            </h2>
            <p className="text-[0.75rem] text-[hsl(var(--text-muted))] m-0 mt-1 flex items-center gap-1">
              <Calendar size={11} />
              {project ? `${formatDate(project.startDate)} → ${formatDate(project.endDate)}` : ''}
            </p>
          </div>
        </div>

        {/* Actions right */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 border border-[hsl(var(--border))] rounded-sm bg-white cursor-pointer text-[hsl(var(--text-secondary))] text-[0.82rem] font-medium hover:bg-[hsl(var(--bg-main))] transition-colors"
          >
            <List size={15} />
            <span>{showGrid ? 'Thu gọn danh sách' : 'Mở rộng danh sách'}</span>
          </button>

          {/* View mode switcher */}
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} className="text-[hsl(var(--text-muted))]" />
            <div className="flex border border-[hsl(var(--border))] rounded-sm overflow-hidden">
              {VIEW_MODES.map((m, idx) => (
                <button
                  key={m.value}
                  onClick={() => handleViewMode(m.value)}
                  className={`py-1.5 px-3.5 border-none cursor-pointer text-[0.82rem] transition-all duration-150 ${viewMode === m.value
                    ? 'font-bold bg-[hsl(var(--primary))] text-white'
                    : 'font-medium bg-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-main))]'
                    } ${idx < VIEW_MODES.length - 1 ? 'border-r border-[hsl(var(--border))]' : ''}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-7 py-2.5 px-6 bg-[hsl(var(--bg-main))] border-b border-[hsl(var(--border))] text-[0.82rem] flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-[hsl(var(--primary))]" />
          <span className="text-[hsl(var(--text-muted))]">Tiến độ dự án:</span>
          <div className="w-[80px] h-[6px] bg-[hsl(var(--border))] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-hover))]"
              style={{ width: `${project?.progress ?? 0}%` }}
            />
          </div>
          <strong className="text-[hsl(var(--primary))]">{project?.progress ?? 0}%</strong>
        </div>

        <span className="text-[hsl(var(--border))] text-base">|</span>

        <div className="flex gap-5">
          {[
            { label: '✅ Hoàn thành', val: doneTasks.length, color: 'text-[hsl(142_70%_38%)]' },
            { label: '🔵 Đang thi công', val: inProgressTasks.length, color: 'text-[hsl(217_91%_52%)]' },
            { label: '⚫ Chưa bắt đầu', val: activeTasks.filter(t => t.progress === 0).length, color: 'text-[hsl(var(--text-muted))]' },
            { label: '⛔ Đã dừng', val: tasks.filter(t => t.status === 'obsolete').length, color: 'text-[hsl(346_84%_50%)]' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <strong className={`text-base ${s.color}`}>{s.val}</strong>
              <span className="text-[hsl(var(--text-muted))]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gantt container ───────────────────────────────────────────── */}
      <div className="flex-1 p-0 bg-white relative">
        <div ref={ganttContainerRef} style={{ width: '100%', height: '100%' }} />

        {phases.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--text-muted))] bg-white z-10">
            Chưa có dữ liệu WBS. Hãy tạo Phase và Task trước.
          </div>
        )}
      </div>

      {/* ── Adjust Progress Modal (Using DailyLogFormModal) ──────────────── */}
      {selectedTaskToAdjust && (
        <DailyLogFormModal
          isOpen={isAdjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          task={selectedTaskToAdjust}
          engineerId={user?.id || ''}
          engineerName={user?.name || ''}
          canManageTechnical={canManageTechnical}
          onSuccess={async () => {
            // Refresh Gantt data
            try {
              const [projs, pList, tList] = await Promise.all([
                projectService.getProjects(),
                projectService.getPhases(projectId!),
                projectService.getTasks(projectId!),
              ]);
              setProject(projs.find(p => p.id === projectId) ?? null);
              setPhases(pList.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
              setTasks(
                tList
                  .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? i + 1 }))
                  .sort((a, b) => a.sortOrder - b.sortOrder)
              );
            } catch (e) {
              console.error("Error refreshing gantt data after log update", e);
            }
          }}
        />
      )}

      {/* ── Custom CSS overrides for light/dark theme ─────────────────── */}
      <style>{`
        /* ── Orange + Blue Gantt Theme (matching reference image) ──────────── */
        
        /* Base task bar (total duration): Royal Blue background */
        .gantt_task_line {
          background-color: #2563eb !important; /* Royal Blue for remaining/total duration */
          border: 1px solid #1d4ed8 !important;
          border-radius: 4px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
        }

        /* Progress fill inside task bar: Vivid Orange */
        .gantt_task_progress {
          background-color: #f97316 !important; /* Vivid Orange for progress fill */
          border-radius: 3px 0 0 3px !important;
        }

        /* Phase bars (Parent WBS Folder): Darker Blue background with Deep Orange progress */
        .gantt-phase .gantt_task_line,
        .gantt-phase-frozen .gantt_task_line {
          background-color: #1d4ed8 !important;
          border: 1px solid #1e40af !important;
          border-radius: 4px !important;
        }

        .gantt-phase .gantt_task_progress,
        .gantt-phase-frozen .gantt_task_progress {
          background-color: #ea580c !important;
          border-radius: 3px 0 0 3px !important;
        }

        /* Obsolete / Stopped tasks */
        .gantt-task-obsolete .gantt_task_line {
          background-color: #94a3b8 !important;
          border-color: #64748b !important;
          opacity: 0.6;
        }
        .gantt-task-obsolete .gantt_task_progress {
          background-color: #64748b !important;
        }

        /* Task Label Text inside bar */
        .gantt_task_content {
          color: #ffffff !important;
          font-weight: 600;
          font-size: 11.5px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.4);
        }

        /* Dependency Arrow Lines (Smooth Red/Orange arrows between task endpoints) */
        .gantt_task_link .gantt_line_wrapper div {
          background-color: #ef4444 !important;
        }
        .gantt_task_link .gantt_link_arrow {
          border-left-color: #ef4444 !important;
          border-right-color: #ef4444 !important;
        }
        .gantt_task_link:hover .gantt_line_wrapper div {
          background-color: #dc2626 !important;
        }
        .gantt_task_link:hover .gantt_link_arrow {
          border-left-color: #dc2626 !important;
          border-right-color: #dc2626 !important;
        }
      `}</style>
    </div>
  );
};
