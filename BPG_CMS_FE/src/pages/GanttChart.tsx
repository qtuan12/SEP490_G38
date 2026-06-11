import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Gantt from 'frappe-gantt';
import '../styles/frappe-gantt.css';
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

      // Estimate phase start = earliest task deadline (or project start)
      const earliestDeadline = phaseTasks.length
        ? phaseTasks.reduce(
            (min, t) => (t.deadline < min ? t.deadline : min),
            phaseTasks[0].deadline
          )
        : (project?.startDate ?? new Date().toISOString().slice(0, 10));
      const latestDeadline = phaseTasks.length
        ? phaseTasks.reduce(
            (max, t) => (t.deadline > max ? t.deadline : max),
            phaseTasks[0].deadline
          )
        : (project?.endDate ?? addDays(earliestDeadline, 30));

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
        start: addDays(earliestDeadline, -1),
        end: latestDeadline,
        progress: phaseProgress,
        custom_class: ph.status === 'frozen' ? 'gantt-phase-frozen' : 'gantt-phase',
      });

      // Task rows
      phaseTasks.forEach((t, idx) => {
        const start = project?.startDate && project.startDate < t.deadline
          ? addDays(t.deadline, -Math.max(7, Math.round((t.progress / 100) * 30)))
          : addDays(t.deadline, -7);

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
          dependencies: idx === 0 ? ph.id : phaseTasks[idx - 1].id,
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
                <div>📋 ${phaseTasks.length} công việc</div>
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
                <div style="margin-top:3px">📅 Hạn: <strong>${formatDate(originalTask.deadline)}</strong></div>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: 'hsl(var(--text-muted))' }}>
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải Gantt Chart...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--danger))' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--bg-card))',
        flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)', background: 'transparent',
              cursor: 'pointer', color: 'hsl(var(--text-secondary))',
              fontSize: '0.85rem', fontWeight: 500,
            }}
          >
            <ArrowLeft size={15} /><span>Quay lại</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Gantt Chart — {project?.name ?? ''}
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={11} />
              {project ? `${formatDate(project.startDate)} → ${formatDate(project.endDate)}` : ''}
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutGrid size={15} style={{ color: 'hsl(var(--text-muted))' }} />
          <div style={{ display: 'flex', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {VIEW_MODES.map(m => (
              <button
                key={m.value}
                onClick={() => handleViewMode(m.value)}
                style={{
                  padding: '6px 14px', border: 'none', cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: viewMode === m.value ? 700 : 500,
                  backgroundColor: viewMode === m.value ? 'hsl(var(--primary))' : 'transparent',
                  color: viewMode === m.value ? '#fff' : 'hsl(var(--text-secondary))',
                  transition: 'all 0.12s',
                  borderRight: m.value !== 'Month' ? '1px solid hsl(var(--border))' : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '28px',
        padding: '10px 24px',
        backgroundColor: 'hsl(var(--bg-main))',
        borderBottom: '1px solid hsl(var(--border))',
        fontSize: '0.82rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <TrendingUp size={14} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-muted))' }}>Tiến độ dự án:</span>
          <div style={{ width: '80px', height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ width: `${project?.progress ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary-hover)))' }} />
          </div>
          <strong style={{ color: 'hsl(var(--primary))' }}>{project?.progress ?? 0}%</strong>
        </div>

        <span style={{ color: 'hsl(var(--border))', fontSize: '1rem' }}>|</span>

        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { label: '✅ Hoàn thành', val: doneTasks.length, color: 'hsl(142 70% 38%)' },
            { label: '🔵 Đang thi công', val: inProgressTasks.length, color: 'hsl(217 91% 52%)' },
            { label: '⚫ Chưa bắt đầu', val: activeTasks.filter(t => t.progress === 0).length, color: 'hsl(var(--text-muted))' },
            { label: '⛔ Đã hủy', val: tasks.filter(t => t.status === 'obsolete').length, color: 'hsl(346 84% 50%)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <strong style={{ color: s.color, fontSize: '1rem' }}>{s.val}</strong>
              <span style={{ color: 'hsl(var(--text-muted))' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gantt container ───────────────────────────────────────────── */}
      <div style={{ padding: '24px', backgroundColor: 'hsl(var(--bg-main))' }}>
        <div className="gantt-wrapper card" style={{ padding: '0', overflow: 'auto', borderRadius: 'var(--radius-md)' }}>
          <div ref={ganttContainerRef} />
        </div>

        {phases.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'hsl(var(--text-muted))' }}>
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
