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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';

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

  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedTaskToAdjust, setSelectedTaskToAdjust] = useState<WBSTask | null>(null);
  const [adjustProgress, setAdjustProgress] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState(false);

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

  // ── build DHTMLX data ────────────────────────────────────────────────
  const buildDhtmlxData = useCallback(() => {
    const data: any[] = [];
    const links: any[] = [];

    phases.forEach(ph => {
      const phaseTasks = tasks.filter(t => t.phaseId === ph.id && t.status !== 'obsolete');
      const progress = phaseTasks.length
        ? Math.round(phaseTasks.reduce((s, t) => s + t.progress, 0) / Math.max(1, phaseTasks.length)) / 100
        : 0;

      let minDate = new Date();
      let maxDate = new Date();
      if (phaseTasks.length > 0) {
        minDate = new Date(Math.min(...phaseTasks.map(t => new Date(t.startDate || t.deadline).getTime())));
        maxDate = new Date(Math.max(...phaseTasks.map(t => new Date(t.deadline).getTime())));
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
      if (t.status === 'obsolete') return;

      let customClass = 'gantt-task';
      if (t.isOverdue) customClass = 'gantt-task-delayed';
      else if (t.progress === 100) customClass = 'gantt-task-done';
      else if (t.progress > 0) customClass = 'gantt-task-inprogress';

      const tStart = new Date(t.startDate || t.deadline);
      const tEnd = new Date(t.deadline);
      let tType = gantt.config.types.task;
      if (tStart.toDateString() === tEnd.toDateString()) {
        tType = gantt.config.types.milestone;
      }

      data.push({
        id: t.id,
        text: t.name,
        start_date: tStart,
        end_date: tEnd,
        type: tType,
        progress: t.progress / 100,
        parent: `phase_${t.phaseId}`,
        custom_class: customClass,
        assignedName: t.assignedName,
        rawTask: t,
      });

      // Handle dependencies
      if (t.predecessorTaskIds && t.predecessorTaskIds.length > 0) {
        t.predecessorTaskIds.forEach(predId => {
          links.push({
            id: `link_${predId}_${t.id}`,
            source: predId.toString(),
            target: t.id.toString(),
            type: '0', // finish_to_start
          });
        });
      }
    });

    return { data, links };
  }, [phases, tasks]);

  // ── configure Gantt & Events ──────────────────────────────────────────
  useEffect(() => {
    if (loading || !ganttContainerRef.current) return;

    // config basic Gantt Settings
    gantt.config.readonly = true;
    gantt.config.columns = [
      { name: "text", label: "Tên công việc", width: "*", tree: true },
      { name: "start_date", label: "Bắt đầu", align: "center", width: 80, template: (obj: any) => formatDate(obj.start_date.toISOString().split('T')[0]) },
      { name: "progress", label: "Tiến độ", align: "center", width: 60, template: (obj: any) => `${Math.round(obj.progress * 100)}%` },
    ];

    // Config tooltips & resource text
    gantt.templates.rightside_text = function(_start: any, _end: any, task: any) {
      if (task.type === gantt.config.types.project) return "";
      return task.assignedName ? `<span style="color: #64748b; font-size: 11px; margin-left: 8px;">👤 ${task.assignedName}</span>` : "";
    };
    
    // Initialize Gantt
    gantt.init(ganttContainerRef.current);
    gantt.clearAll();

    const ganttData = buildDhtmlxData();
    gantt.parse(ganttData);

    const clickEventId = gantt.attachEvent("onTaskClick", function(id: string | number) {
      const taskObj = gantt.getTask(id);
      if (taskObj.type !== gantt.config.types.project && taskObj.rawTask) {
        const wbsTask = taskObj.rawTask as WBSTask;
        if ((user?.role === 'technicalmanager' || user?.role === 'admin') && wbsTask.status !== 'obsolete') {
          setSelectedTaskToAdjust(wbsTask);
          setAdjustProgress(wbsTask.progress);
          setAdjustReason('');
          setAdjustModalOpen(true);
        }
      }
      return true;
    });

    return () => {
      gantt.detachEvent(clickEventId);
      gantt.clearAll();
    };
  }, [loading, phases, tasks, buildDhtmlxData, user]);

  // ── change view mode ──────────────────────────────────────────────────
  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  useEffect(() => {
    if (loading || !ganttContainerRef.current) return;
    
    if (viewMode === 'Day') {
      gantt.config.scale_unit = "day";
      gantt.config.date_scale = "%d %M";
      gantt.config.scales = [
        { unit: "day", step: 1, format: "%d %M" }
      ];
    } else if (viewMode === 'Week') {
      gantt.config.scales = [
        { unit: "week", step: 1, format: "Tuần %W" },
        { unit: "day", step: 1, format: "%d %M" }
      ];
    } else if (viewMode === 'Month') {
      gantt.config.scales = [
        { unit: "month", step: 1, format: "%M %Y" },
        { unit: "week", step: 1, format: "Tuần %W" }
      ];
    }
    gantt.render();
  }, [viewMode, loading]);

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
      <div className="flex-1 p-0 bg-white relative">
        <div ref={ganttContainerRef} style={{ width: '100%', height: '100%' }} />

        {phases.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[hsl(var(--text-muted))] bg-white z-10">
            Chưa có dữ liệu WBS. Hãy tạo Phase và Task trước.
          </div>
        )}
      </div>

      {/* ── Adjust Progress Modal ─────────────────────────────────────── */}
      {selectedTaskToAdjust && (
        <Modal
          isOpen={isAdjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          title={<span className="text-[#1d4ed8] font-bold text-lg">Cập nhật tiến độ</span>}
          maxWidth="500px"
        >
          <div className="flex flex-col gap-6">
            
            {/* Progress Row */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[0.95rem] font-semibold text-gray-800">Tiến độ hoàn thành (%)</span>
                <span className="text-2xl font-bold text-[#1d4ed8]">{adjustProgress}%</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-[0.8rem] text-gray-500 whitespace-nowrap min-w-[70px]">
                  {selectedTaskToAdjust.progress}% (Hiện tại)
                </span>
                
                <input
                  type="range"
                  min={selectedTaskToAdjust.progress}
                  max={100}
                  value={adjustProgress}
                  onChange={(e) => setAdjustProgress(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1d4ed8]"
                />
                
                <span className="text-[0.8rem] text-gray-500 whitespace-nowrap">100%</span>
              </div>
              <div className="mt-2 text-[0.75rem] text-gray-500">
                * Khóa cứng chiều lùi: Bạn chỉ có thể kéo tiến độ tiến lên hoặc giữ nguyên.
              </div>
            </div>

            {/* Alert Box */}
            <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl p-3.5 flex items-center gap-3">
              <div className="text-[#1d4ed8] border-2 border-[#1d4ed8] rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px] shrink-0">!</div>
              <span className="text-[0.85rem] text-[#1e3a8a]">
                Báo cáo cho việc: <strong className="font-bold">{selectedTaskToAdjust.name}</strong>
              </span>
            </div>

            {/* Text Area */}
            <div>
              <label className="block text-[0.9rem] font-semibold text-gray-800 mb-2">
                Diễn biến công việc chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Mô tả công việc đã làm hôm nay, số lượng nhân công huy động, các khó khăn gặp phải nếu có..."
                rows={4}
                className="w-full p-3.5 bg-white border border-gray-300 rounded-xl text-[0.85rem] focus:outline-none focus:border-[#1d4ed8] focus:ring-1 focus:ring-[#1d4ed8] resize-y"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-[0.85rem] font-semibold bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                disabled={isAdjusting}
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  if (!adjustReason.trim()) {
                    alert('Vui lòng nhập lý do (diễn biến công việc chi tiết).');
                    return;
                  }
                  try {
                    setIsAdjusting(true);
                    await projectService.adjustTaskProgressDirectly(selectedTaskToAdjust.id, adjustProgress, adjustReason);
                    // Refresh data
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
                    setAdjustModalOpen(false);
                  } catch (e: any) {
                    alert(e.message || 'Lỗi khi cập nhật tiến độ');
                  } finally {
                    setIsAdjusting(false);
                  }
                }}
                className="px-6 py-2.5 rounded-xl border-none text-white text-[0.85rem] font-semibold bg-[#1d4ed8] hover:bg-blue-700 transition-colors cursor-pointer"
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Đang gửi...' : 'Cập nhật tiến độ'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Custom CSS overrides for light/dark theme ─────────────────── */}
      <style>{`
        /* DHTMLX Gantt Custom Theme Overrides */
        .gantt-phase .gantt_task_progress {
          background-color: hsl(271 81% 52%) !important;
        }
        .gantt-phase .gantt_task_content {
          background-color: hsl(271 81% 52% / 0.15) !important;
          border: 1px solid hsl(271 81% 52%) !important;
        }
        
        .gantt-phase-frozen .gantt_task_progress {
          background-color: hsl(142 70% 38%) !important;
        }
        .gantt-phase-frozen .gantt_task_content {
          background-color: hsl(142 70% 38% / 0.15) !important;
          border: 1px solid hsl(142 70% 38%) !important;
        }

        .gantt-task-done .gantt_task_progress {
          background-color: hsl(142 70% 38%) !important;
        }
        .gantt-task-done .gantt_task_content {
          background-color: hsl(142 70% 38% / 0.15) !important;
          border: 1px solid hsl(142 70% 38%) !important;
        }

        .gantt-task-inprogress .gantt_task_progress {
          background-color: hsl(38 92% 50%) !important;
        }
        .gantt-task-inprogress .gantt_task_content {
          background-color: hsl(38 92% 50% / 0.15) !important;
          border: 1px solid hsl(38 92% 50%) !important;
        }

        .gantt-task-delayed .gantt_task_progress {
          background-color: hsl(346 84% 50%) !important;
        }
        .gantt-task-delayed .gantt_task_content {
          background-color: hsl(346 84% 50% / 0.15) !important;
          border: 1px solid hsl(346 84% 50%) !important;
        }

        /* Default task styles */
        .gantt_task_line {
          border-radius: 4px;
        }
        .gantt_task_progress {
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
