import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Gantt from 'frappe-gantt';

import { projectService } from '../services/projectService';
import type {WBSPhase, WBSTask, Project} from '../types/common';
import {
  ArrowLeft,
  Calendar,
  Loader2,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';

// ── Frappe Gantt task shape ────────────────────────────────────────────────
interface FrappeTask {
  id: string;
  name: string;
  start: string;   // 'YYYY-MM-DD'
  end: string;     // 'YYYY-MM-DD'
  progress: number;
  dependencies?: string;
  custom_class?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────
const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const formatDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

type ViewMode = 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month';
const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Ngày', value: 'Day' },
  { label: 'Tuần', value: 'Week' },
  { label: 'Tháng', value: 'Month' },
];

// ── component ────────────────────────────────────────────────────────────
export const GanttChart: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Week');

  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);

  // ── load data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [projs, pList, tList] = await Promise.all([
          projectService.getProjects(),
          projectService.getPhases(projectId),
          projectService.getTasks(projectId),
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

  // ── build Frappe task list ────────────────────────────────────────────
  const buildFrappeTasks = useCallback((): FrappeTask[] => {
    const result: FrappeTask[] = [];

    phases.forEach(ph => {
      const phaseTasks = tasks
        .filter(t => t.phaseId === ph.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      // Estimate phase start = earliest task start/deadline
      const earliestStart = phaseTasks.length
        ? phaseTasks.reduce(
            (min, t) => {
              const start = t.startDate || addDays(t.deadline, -7);
              return start < min ? start : min;
            },
            phaseTasks[0].startDate || addDays(phaseTasks[0].deadline, -7)
          )
        : (project?.startDate ?? new Date().toISOString().slice(0, 10));

      const latestDeadline = phaseTasks.length
        ? phaseTasks.reduce(
            (max, t) => (t.deadline > max ? t.deadline : max),
            phaseTasks[0].deadline
          )
        : (project?.endDate ?? addDays(earliestStart, 30));

      const phaseProgress = phaseTasks.length
        ? Math.round(
            phaseTasks
              .filter(t => t.status !== 'obsolete')
              .reduce((s, t) => s + t.progress, 0) /
              Math.max(1, phaseTasks.filter(t => t.status !== 'obsolete').length)
          )
        : 0;

      // Phase row
      result.push({
        id: ph.id,
        name: `📁 ${ph.name}`,
        start: earliestStart,
        end: latestDeadline,
        progress: phaseProgress,
        custom_class: ph.status === 'frozen' ? 'gantt-phase-frozen' : 'gantt-phase',
      });

      // Task rows
      phaseTasks.forEach((t, idx) => {
        const start = t.startDate || (project?.startDate && project.startDate < t.deadline
          ? addDays(t.deadline, -Math.max(7, Math.round((t.progress / 100) * 30)))
          : addDays(t.deadline, -7));

        let customClass = 'gantt-task';
        if (t.status === 'obsolete') customClass = 'gantt-task-obsolete';
        else if (t.progress === 100) customClass = 'gantt-task-done';
        else if (t.progress > 0) customClass = 'gantt-task-inprogress';

        result.push({
          id: t.id,
          name: `  ${idx + 1}. ${t.name}`,
          start,
          end: t.deadline,
          progress: t.progress,
          dependencies: '', // Remove fake waterfall dependencies
          custom_class: customClass,
        });
      });
    });

    return result;
  }, [phases, tasks, project]);

  // ── init / update Gantt instance ──────────────────────────────────────
  useEffect(() => {
    if (loading || !ganttContainerRef.current || phases.length === 0) return;

    const frappeTasks = buildFrappeTasks();
    if (frappeTasks.length === 0) return;

    // Clear previous instance
    ganttContainerRef.current.innerHTML = '';

    ganttInstanceRef.current = new Gantt(ganttContainerRef.current, frappeTasks, {
      view_mode: viewMode,
      date_format: 'YYYY-MM-DD',
      language: 'en',
      popup_trigger: 'click',
      custom_popup_html: (task: FrappeTask) => {
        const originalTask = tasks.find(t => t.id === task.id);
        const originalPhase = phases.find(p => p.id === task.id);

        if (originalPhase) {
          const phaseTasks = tasks.filter(t => t.phaseId === originalPhase.id && t.status !== 'obsolete');
          return `
            <div style="padding:12px 14px;min-width:220px;font-family:inherit">
              <strong style="font-size:0.9rem;color:#1e293b">${originalPhase.name}</strong>
              <div style="margin-top:8px;font-size:0.78rem;color:#64748b">
                <div>📅 Từ: <strong>${formatDate(task.start)}</strong> đến <strong>${formatDate(task.end)}</strong></div>
                <div style="margin-top:3px">📋 ${phaseTasks.length} công việc</div>
                <div style="margin-top:4px">Tiến độ: <strong style="color:#3b82f6">${task.progress}%</strong></div>
                ${originalPhase.status === 'frozen' ? '<div style="margin-top:4px;color:#16a34a;font-weight:600">✅ Đã nghiệm thu</div>' : ''}
              </div>
              <div style="margin-top:8px;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden">
                <div style="width:${task.progress}%;height:100%;background:${originalPhase.status === 'frozen' ? '#16a34a' : '#3b82f6'}"></div>
              </div>
            </div>`;
        }

        if (originalTask) {
          return `
            <div style="padding:12px 14px;min-width:220px;font-family:inherit">
              <strong style="font-size:0.85rem;color:#1e293b">${originalTask.name}</strong>
              <div style="margin-top:8px;font-size:0.78rem;color:#64748b">
                <div>👤 ${originalTask.assignedName ?? 'Chưa phân công'}</div>
                <div style="margin-top:3px">📅 Từ: <strong>${formatDate(task.start)}</strong> đến <strong>${formatDate(task.end)}</strong></div>
                <div style="margin-top:3px">Tiến độ: <strong style="color:${originalTask.progress === 100 ? '#16a34a' : '#3b82f6'}">${originalTask.progress}%</strong></div>
                ${originalTask.status === 'obsolete' ? '<div style="margin-top:4px;color:#dc2626;font-weight:600">⛔ Đã hủy</div>' : ''}
              </div>
              <div style="margin-top:8px;background:#e2e8f0;border-radius:4px;height:6px;overflow:hidden">
                <div style="width:${task.progress}%;height:100%;background:${originalTask.progress === 100 ? '#16a34a' : originalTask.progress > 0 ? '#3b82f6' : '#94a3b8'}"></div>
              </div>
            </div>`;
        }
        return `<div style="padding:10px">${task.name}</div>`;
      },
    } as any);
  }, [loading, phases, tasks, viewMode, buildFrappeTasks]);

  // ── change view mode ──────────────────────────────────────────────────
  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

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
    <div className="flex flex-col gap-0">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 px-6 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-card))] flex-wrap gap-3">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 py-1.5 px-3.5 border border-[hsl(var(--border))] rounded-sm bg-transparent cursor-pointer text-[hsl(var(--text-secondary))] text-[0.85rem] font-medium hover:bg-[hsl(var(--bg-main))] transition-colors"
          >
            <ArrowLeft size={15} /><span>Quay lại</span>
          </button>
          <div>
            <h2 className="text-[1.1rem] font-bold m-0">
              Gantt Chart — {project?.name ?? ''}
            </h2>
            <p className="text-[0.75rem] text-[hsl(var(--text-muted))] m-0 mt-1 flex items-center gap-1">
              <Calendar size={11} />
              {project ? `${formatDate(project.startDate)} → ${formatDate(project.endDate)}` : ''}
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-2">
          <LayoutGrid size={15} className="text-[hsl(var(--text-muted))]" />
          <div className="flex border border-[hsl(var(--border))] rounded-sm overflow-hidden">
            {VIEW_MODES.map((m, idx) => (
              <button
                key={m.value}
                onClick={() => handleViewMode(m.value)}
                className={`py-1.5 px-3.5 border-none cursor-pointer text-[0.82rem] transition-all duration-150 ${
                  viewMode === m.value 
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

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-7 py-2.5 px-6 bg-[hsl(var(--bg-main))] border-b border-[hsl(var(--border))] text-[0.82rem] flex-wrap">
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
            { label: '⛔ Đã hủy', val: tasks.filter(t => t.status === 'obsolete').length, color: 'text-[hsl(346_84%_50%)]' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <strong className={`text-base ${s.color}`}>{s.val}</strong>
              <span className="text-[hsl(var(--text-muted))]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gantt container ───────────────────────────────────────────── */}
      <div className="p-6 bg-[hsl(var(--bg-main))]">
        <div className="gantt-wrapper card p-0 overflow-auto rounded-md">
          <div ref={ganttContainerRef} />
        </div>

        {phases.length === 0 && (
          <div className="text-center py-15 text-[hsl(var(--text-muted))]">
            Chưa có dữ liệu WBS. Hãy tạo Phase và Task trước.
          </div>
        )}
      </div>

      {/* ── Custom CSS overrides for light/dark theme ─────────────────── */}
      <style>{`
        .gantt-wrapper .gantt .bar-group .bar {
          fill: hsl(217 91% 52% / 0.2) !important;
          stroke: hsl(217 91% 52%) !important;
        }
        .gantt-wrapper .gantt .bar-group .bar-progress {
          fill: hsl(217 91% 52%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-phase .bar {
          fill: hsl(271 81% 52% / 0.15) !important;
          stroke: hsl(271 81% 52%) !important;
          rx: 4px;
        }
        .gantt-wrapper .gantt .bar-group.gantt-phase .bar-progress {
          fill: hsl(271 81% 52%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-phase-frozen .bar {
          fill: hsl(142 70% 38% / 0.15) !important;
          stroke: hsl(142 70% 38%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-phase-frozen .bar-progress {
          fill: hsl(142 70% 38%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-task-done .bar {
          fill: hsl(142 70% 38% / 0.15) !important;
          stroke: hsl(142 70% 38%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-task-done .bar-progress {
          fill: hsl(142 70% 38%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-task-inprogress .bar {
          fill: hsl(38 92% 50% / 0.15) !important;
          stroke: hsl(38 92% 50%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-task-inprogress .bar-progress {
          fill: hsl(38 92% 50%) !important;
        }
        .gantt-wrapper .gantt .bar-group.gantt-task-obsolete .bar {
          fill: hsl(346 84% 50% / 0.1) !important;
          stroke: hsl(346 84% 50%) !important;
          opacity: 0.5;
        }
        .gantt-wrapper .gantt .bar-label {
          font-family: inherit !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          fill: hsl(var(--text-primary)) !important;
        }
        .gantt-wrapper .gantt .lower-text,
        .gantt-wrapper .gantt .upper-text {
          font-family: inherit !important;
          fill: hsl(var(--text-secondary)) !important;
          font-size: 11px !important;
          font-weight: 600 !important;
        }
        .gantt-wrapper .gantt .grid-header {
          fill: hsl(var(--bg-card)) !important;
          stroke: hsl(var(--border)) !important;
        }
        .gantt-wrapper .gantt .grid-row {
          fill: transparent !important;
        }
        .gantt-wrapper .gantt .grid-row:nth-child(even) {
          fill: hsl(var(--bg-main) / 0.5) !important;
        }
        .gantt-wrapper .gantt .row-line,
        .gantt-wrapper .gantt .tick {
          stroke: hsl(var(--border)) !important;
        }
        .gantt-wrapper .gantt .today-highlight {
          fill: hsl(0 84% 55% / 0.08) !important;
        }
        .gantt-wrapper .gantt svg {
          background: hsl(var(--bg-card)) !important;
        }
        .gantt-wrapper .popup-wrapper {
          border-radius: 10px !important;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2) !important;
          border: 1px solid hsl(var(--border)) !important;
          overflow: hidden !important;
        }
        .gantt-wrapper .popup-wrapper .pointer {
          display: none !important;
        }
        .gantt-wrapper .bar-group .bar-wrapper:hover .bar {
          filter: brightness(1.1) !important;
        }
        .gantt-wrapper .handle.progress {
          fill: hsl(var(--primary)) !important;
        }
      `}</style>
    </div>
  );
};
