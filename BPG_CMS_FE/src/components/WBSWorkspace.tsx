import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project, DailyLog } from '../services/projectService';
import { AssignEngineerModal } from './WBSModals';
import { DailyLogFormModal } from './DailyLogFormModal';
import { Modal } from './Modal';
import {
  Folder,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Calendar,
  History,
  CheckCircle,
  UserPlus,
  TrendingUp,
  FileSignature,
  User,
  Trash2,
  AlertCircle,
  Loader2,
  X,
  Check,
  FolderPlus,
  FilePlus2,
  Pencil,
  MoreVertical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WBSWorkspaceProps {
  projectId: string;
}

export const WBSWorkspace: React.FC<WBSWorkspaceProps> = ({ projectId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phases, setPhases] = useState<WBSPhase[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tree collapse state
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});

  // Selected task state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Modal triggers
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Detailed task logs states
  const [taskLogs, setTaskLogs] = useState<DailyLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // ── CREATE Phase inline ──────────────────────────────
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [savingPhase, setSavingPhase] = useState(false);
  const phaseInputRef = useRef<HTMLInputElement>(null);

  // ── CREATE Task inline ───────────────────────────────
  const [addingTaskForPhaseId, setAddingTaskForPhaseId] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const taskInputRef = useRef<HTMLInputElement>(null);

  // ── RENAME Phase inline ──────────────────────────────
  const [renamingPhaseId, setRenamingPhaseId] = useState<string | null>(null);
  const [renamePhaseValue, setRenamePhaseValue] = useState('');
  const [savingRenamePhase, setSavingRenamePhase] = useState(false);
  const renamePhaseRef = useRef<HTMLInputElement>(null);

  // ── RENAME Task inline ───────────────────────────────
  const [renamingTaskId, setRenamingTaskId] = useState<string | null>(null);
  const [renameTaskValue, setRenameTaskValue] = useState('');
  const [savingRenameTask, setSavingRenameTask] = useState(false);
  const renameTaskRef = useRef<HTMLInputElement>(null);

  // ── Hover state ──────────────────────────────────────
  const [hoveredPhaseId, setHoveredPhaseId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // ── Context-menu (3-dot) state ───────────────────────
  const [phaseMenuId, setPhaseMenuId] = useState<string | null>(null);
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = () => { setPhaseMenuId(null); setTaskMenuId(null); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Auto-focus inline inputs
  useEffect(() => { if (addingPhase && phaseInputRef.current) phaseInputRef.current.focus(); }, [addingPhase]);
  useEffect(() => { if (addingTaskForPhaseId && taskInputRef.current) taskInputRef.current.focus(); }, [addingTaskForPhaseId]);
  useEffect(() => { if (renamingPhaseId && renamePhaseRef.current) renamePhaseRef.current.focus(); }, [renamingPhaseId]);
  useEffect(() => { if (renamingTaskId && renameTaskRef.current) renameTaskRef.current.focus(); }, [renamingTaskId]);

  const loadTaskLogs = async () => {
    if (!selectedTaskId) return;
    setLoadingLogs(true);
    try {
      const allLogs = await projectService.getDailyLogs(projectId);
      setTaskLogs(allLogs.filter(l => l.taskId === selectedTaskId));
    } catch (err) { console.error(err); }
    finally { setLoadingLogs(false); }
  };

  useEffect(() => {
    if (selectedTaskId && isLogsOpen) loadTaskLogs();
  }, [selectedTaskId, isLogsOpen, success]);

  const isTPKTOrPL = user?.role === 'tpkt' || user?.role === 'admin';

  const loadWBSData = async () => {
    setLoading(true);
    try {
      const pList = await projectService.getPhases(projectId);
      const tList = await projectService.getTasks(projectId);
      const allProjs = await projectService.getProjects();
      setProject(allProjs.find(p => p.id === projectId) || null);
      setPhases(pList);
      setTasks(tList);
      const expands: Record<string, boolean> = {};
      pList.forEach(p => { expands[p.id] = true; });
      setExpandedPhases(expands);
      if (tList.length > 0 && !selectedTaskId) setSelectedTaskId(tList[0].id);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải cơ cấu WBS.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWBSData(); }, [projectId]);

  const togglePhase = (phaseId: string) =>
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadWBSData();
  };
  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) : null;

  const isPhaseReadyForAcceptance = (phaseId: string) => {
    const phaseTasks = tasks.filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
    if (phaseTasks.length === 0) return false;
    return phaseTasks.every(t => t.progress === 100);
  };

  const canEdit = isTPKTOrPL && project?.status !== 'paused' && project?.status !== 'done';

  // ── CRUD Handlers ─────────────────────────────────────

  const handleSavePhase = async () => {
    if (!newPhaseName.trim()) { handleError('Tên Phase không được để trống.'); return; }
    setSavingPhase(true);
    try {
      await projectService.createPhase(projectId, newPhaseName.trim());
      setNewPhaseName(''); setAddingPhase(false);
      handleSuccess(`Đã tạo Phase mới: ${newPhaseName.trim()}`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi tạo Phase.'); }
    finally { setSavingPhase(false); }
  };

  const handleSaveTask = async (phaseId: string) => {
    if (!newTaskName.trim()) { handleError('Tên Task không được để trống.'); return; }
    if (!newTaskDeadline) { handleError('Vui lòng chọn deadline.'); return; }
    setSavingTask(true);
    try {
      await projectService.createTask({ phaseId, projectId, name: newTaskName.trim(), deadline: newTaskDeadline, sortOrder: 0 });
      setNewTaskName(''); setNewTaskDeadline(''); setAddingTaskForPhaseId(null);
      handleSuccess(`Đã tạo Task mới: ${newTaskName.trim()}`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi tạo Task.'); }
    finally { setSavingTask(false); }
  };

  const handleRenamePhase = async (phaseId: string) => {
    if (!renamePhaseValue.trim()) { handleError('Tên Phase không được để trống.'); return; }
    setSavingRenamePhase(true);
    try {
      await projectService.updatePhase(phaseId, { name: renamePhaseValue.trim() });
      setRenamingPhaseId(null);
      handleSuccess('Đã đổi tên Phase.');
    } catch (err: any) { handleError(err.message || 'Lỗi khi đổi tên Phase.'); }
    finally { setSavingRenamePhase(false); }
  };

  const handleDeletePhase = async (phaseId: string, phaseName: string) => {
    if (!window.confirm(`Xác nhận xóa Phase "${phaseName}" và toàn bộ Task bên trong?`)) return;
    try {
      await projectService.deletePhase(phaseId);
      if (selectedTask && tasks.find(t => t.id === selectedTaskId)?.phaseId === phaseId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Phase "${phaseName}".`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Phase.'); }
  };

  const handleReorderPhase = async (phaseId: string, direction: 'up' | 'down') => {
    try {
      await projectService.reorderPhase(projectId, phaseId, direction);
      loadWBSData();
    } catch (err: any) { handleError(err.message || 'Lỗi khi sắp xếp.'); }
  };

  const handleRenameTask = async (taskId: string) => {
    if (!renameTaskValue.trim()) { handleError('Tên Task không được để trống.'); return; }
    setSavingRenameTask(true);
    try {
      await projectService.renameTask(taskId, renameTaskValue.trim());
      setRenamingTaskId(null);
      handleSuccess('Đã đổi tên Task.');
    } catch (err: any) { handleError(err.message || 'Lỗi khi đổi tên Task.'); }
    finally { setSavingRenameTask(false); }
  };

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    if (!window.confirm(`Xác nhận xóa hẳn công việc "${taskName}"?`)) return;
    try {
      await projectService.deleteTask(taskId);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      handleSuccess(`Đã xóa Task "${taskName}".`);
    } catch (err: any) { handleError(err.message || 'Lỗi khi xóa Task.'); }
  };

  const handleReorderTask = async (phaseId: string, taskId: string, direction: 'up' | 'down') => {
    try {
      await projectService.reorderTask(phaseId, taskId, direction);
      loadWBSData();
    } catch (err: any) { handleError(err.message || 'Lỗi khi sắp xếp.'); }
  };

  const handleObsolete = async () => {
    const reason = prompt('Nhập lý do hủy bỏ công việc này:');
    if (!reason || reason.trim().length < 5) { handleError('Lý do hủy bỏ không hợp lệ (ít nhất 5 ký tự).'); return; }
    try {
      await projectService.markTaskObsolete(selectedTask!.id, reason, { name: user?.name || '', role: user?.role || '' });
      handleSuccess('Đã đánh dấu hủy bỏ công việc.');
    } catch (err: any) { handleError(err.message); }
  };

  // ── Inline input style ────────────────────────────────
  const inlineInputStyle: React.CSSProperties = {
    fontSize: '0.85rem', padding: '5px 9px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid hsl(var(--primary) / 0.5)',
    backgroundColor: 'hsl(var(--bg-card))',
    color: 'hsl(var(--text-primary))',
    flex: 1, outline: 'none',
  };
  const inlineBtnSave: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '3px',
    padding: '4px 8px', fontSize: '0.78rem', border: 'none',
    borderRadius: 'var(--radius-sm)', background: 'hsl(var(--primary))',
    color: '#fff', cursor: 'pointer', fontWeight: 600, flexShrink: 0,
  };
  const inlineBtnCancel: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '3px',
    padding: '4px 8px', fontSize: '0.78rem',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius-sm)', background: 'transparent',
    color: 'hsl(var(--text-muted))', cursor: 'pointer', flexShrink: 0,
  };
  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '7px 12px', fontSize: '0.82rem', cursor: 'pointer',
    color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap',
    transition: 'background 0.1s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Alerts */}
      {success && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(142 70% 30%)', fontSize: '0.85rem' }}>
          {success}
        </div>
      )}
      {error && (
        <div className="animate-fade-in" style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.2)', borderRadius: 'var(--radius-sm)', color: 'hsl(346 84% 35%)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Cơ cấu phân rã công việc (WBS)</h3>
        <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
          Số thứ tự được hiển thị trước tên · Nhấn ▲▼ để sắp xếp lại · Click <strong>⋮</strong> để đổi tên / xóa
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>

        {/* ─── Left: WBS Tree ─────────────────────────────── */}
        <div className="card" style={{ padding: '20px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Sơ đồ hình cây Phase → Task
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))' }}>Đang tải...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>

              {phases.length === 0 && !addingPhase && (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                  Chưa có dữ liệu WBS. Nhấn "+ Thêm Phase" để bắt đầu.
                </div>
              )}

              {/* ═══ PHASE ROWS ═════════════════════════════════ */}
              {phases.map((ph, phaseIndex) => {
                const phaseTasks = tasks
                  .filter(t => t.phaseId === ph.id)
                  .map((t, i) => ({ ...t, sortOrder: t.sortOrder ?? (i + 1) }))
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const isExpanded = expandedPhases[ph.id];
                const isFrozen = ph.status === 'frozen';
                const readyForAcceptance = isPhaseReadyForAcceptance(ph.id) && !isFrozen;
                const isHovered = hoveredPhaseId === ph.id;
                const isAddingTaskHere = addingTaskForPhaseId === ph.id;
                const isRenamingThis = renamingPhaseId === ph.id;
                const showMenu = phaseMenuId === ph.id;
                const isFirstPhase = phaseIndex === 0;
                const isLastPhase = phaseIndex === phases.length - 1;

                return (
                  <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>

                    {/* Phase row */}
                    <div
                      onMouseEnter={() => setHoveredPhaseId(ph.id)}
                      onMouseLeave={() => setHoveredPhaseId(null)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 8px',
                        backgroundColor: isFrozen ? 'hsl(var(--success-glow) / 0.08)' : isHovered ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main) / 0.5)',
                        borderRadius: 'var(--radius-sm)',
                        border: isFrozen ? '1px solid hsl(var(--success) / 0.2)' : isHovered ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border))',
                        fontWeight: 600, fontSize: '0.9rem',
                        transition: 'all 0.13s ease',
                        position: 'relative',
                      }}
                    >
                      {/* Order number + ▲▼ buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '18px' }}>
                        {canEdit && !isRenamingThis && (isHovered || isFirstPhase && isLastPhase) ? (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'up'); }}
                              disabled={isFirstPhase}
                              title="Di chuyển lên"
                              style={{ background: 'none', border: 'none', cursor: isFirstPhase ? 'not-allowed' : 'pointer', padding: 0, color: isFirstPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleReorderPhase(ph.id, 'down'); }}
                              disabled={isLastPhase}
                              title="Di chuyển xuống"
                              style={{ background: 'none', border: 'none', cursor: isLastPhase ? 'not-allowed' : 'pointer', padding: 0, color: isLastPhase ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                            >
                              <ChevronDown size={11} />
                            </button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(var(--text-muted))', lineHeight: 1.2, textAlign: 'center' }}>
                            {phaseIndex + 1}
                          </span>
                        )}
                      </div>

                      {/* Collapse toggle */}
                      <button onClick={() => togglePhase(ph.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'hsl(var(--text-secondary))', flexShrink: 0 }}>
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <Folder size={15} style={{ color: isFrozen ? 'hsl(var(--success))' : 'hsl(var(--primary))', flexShrink: 0 }} />

                      {/* Name / Rename input */}
                      {isRenamingThis ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                          <input
                            ref={renamePhaseRef}
                            type="text"
                            value={renamePhaseValue}
                            onChange={e => setRenamePhaseValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenamePhase(ph.id); if (e.key === 'Escape') setRenamingPhaseId(null); }}
                            style={inlineInputStyle}
                          />
                          <button onClick={() => handleRenamePhase(ph.id)} disabled={savingRenamePhase} style={inlineBtnSave}>
                            {savingRenamePhase ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                          <button onClick={() => setRenamingPhaseId(null)} style={inlineBtnCancel}><X size={11} /></button>
                        </div>
                      ) : (
                        <span
                          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isFrozen ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))', textDecoration: isFrozen ? 'line-through' : 'none' }}
                          title="Double-click để đổi tên"
                          onDoubleClick={() => { if (canEdit && !isFrozen) { setRenamingPhaseId(ph.id); setRenamePhaseValue(ph.name); setPhaseMenuId(null); } }}
                        >
                          {ph.name}
                        </span>
                      )}

                      {/* Badge */}
                      {!isRenamingThis && (isFrozen ? (
                        <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate(`/projects/${projectId}/phases/${ph.id}/acceptance`)}>Đã nghiệm thu</span>
                      ) : readyForAcceptance ? (
                        <span className="badge badge-warning animate-fade-in" style={{ fontSize: '0.6rem', padding: '1px 5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}
                          onClick={() => { if (isTPKTOrPL) navigate(`/projects/${projectId}/phases/${ph.id}/acceptance`); }}>
                          <FileSignature size={9} /><span>Chờ nghiệm thu</span>
                        </span>
                      ) : (
                        <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '1px 5px', flexShrink: 0 }}>{phaseTasks.length} việc</span>
                      ))}

                      {/* Action buttons (hover) */}
                      {!isRenamingThis && canEdit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: isHovered || showMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }}>
                          {/* + Task */}
                          {!isFrozen && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedPhases(prev => ({ ...prev, [ph.id]: true })); setAddingTaskForPhaseId(isAddingTaskHere ? null : ph.id); setNewTaskName(''); setNewTaskDeadline(''); }}
                              title="Thêm Task"
                              style={{ background: 'hsl(var(--primary))', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <FilePlus2 size={11} />
                            </button>
                          )}

                          {/* ⋮ menu */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setPhaseMenuId(showMenu ? null : ph.id); setTaskMenuId(null); }}
                              title="Tùy chọn"
                              style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0 }}
                            >
                              <MoreVertical size={11} />
                            </button>

                            {showMenu && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '24px', zIndex: 200, backgroundColor: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '160px', overflow: 'hidden' }}>
                                {!isFrozen && (
                                  <div
                                    style={menuItemStyle}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setRenamingPhaseId(ph.id); setRenamePhaseValue(ph.name); setPhaseMenuId(null); }}
                                  >
                                    <Pencil size={13} style={{ color: 'hsl(var(--primary))' }} />
                                    <span>Đổi tên Phase</span>
                                  </div>
                                )}
                                {!isFrozen && (
                                  <div
                                    style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                    onClick={() => { setPhaseMenuId(null); handleDeletePhase(ph.id, ph.name); }}
                                  >
                                    <Trash2 size={13} />
                                    <span>Xóa Phase</span>
                                  </div>
                                )}
                                {isFrozen && (
                                  <div style={{ ...menuItemStyle, cursor: 'default', opacity: 0.5, fontSize: '0.78rem' }}>
                                    Phase đã nghiệm thu (khóa)
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Task children */}
                    {isExpanded && (
                      <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', borderLeft: '1px dashed hsl(var(--border-light))', marginLeft: '18px', marginTop: '2px' }}>
                        {phaseTasks.map((t, taskIndex) => {
                          const isSelected = selectedTaskId === t.id;
                          const isHoveredTask = hoveredTaskId === t.id;
                          const isRenamingTask = renamingTaskId === t.id;
                          const showTaskMenu = taskMenuId === t.id;
                          // Task is locked for rename/delete once it has been worked on
                          const isWorkedOn = t.progress > 0 || t.history.length > 0;
                          const isFirstTask = taskIndex === 0;
                          const isLastTask = taskIndex === phaseTasks.length - 1;

                          return (
                            <div
                              key={t.id}
                              onMouseEnter={() => setHoveredTaskId(t.id)}
                              onMouseLeave={() => setHoveredTaskId(null)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '6px 8px',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                                backgroundColor: isSelected ? 'hsl(var(--primary-glow))' : isHoveredTask ? 'hsl(var(--bg-main) / 0.6)' : 'transparent',
                                cursor: isRenamingTask ? 'default' : 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all var(--transition-fast)',
                                opacity: t.status === 'obsolete' ? 0.6 : 1,
                                position: 'relative',
                              }}
                              onClick={() => { if (!isRenamingTask) setSelectedTaskId(t.id); }}
                            >
                              {/* Task order number + ▲▼ */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '16px' }} onClick={e => e.stopPropagation()}>
                                {canEdit && !isFrozen && t.status !== 'obsolete' && !isRenamingTask && isHoveredTask ? (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'up'); }}
                                      disabled={isFirstTask}
                                      title="Di chuyển lên"
                                      style={{ background: 'none', border: 'none', cursor: isFirstTask ? 'not-allowed' : 'pointer', padding: 0, color: isFirstTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronUp size={10} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleReorderTask(ph.id, t.id, 'down'); }}
                                      disabled={isLastTask}
                                      title="Di chuyển xuống"
                                      style={{ background: 'none', border: 'none', cursor: isLastTask ? 'not-allowed' : 'pointer', padding: 0, color: isLastTask ? 'hsl(var(--border))' : 'hsl(var(--primary))', lineHeight: 1, display: 'flex' }}
                                    >
                                      <ChevronDown size={10} />
                                    </button>
                                  </>
                                ) : (
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(var(--text-muted))', opacity: 0.7 }}>
                                    {taskIndex + 1}
                                  </span>
                                )}
                              </div>

                              <FileText size={13} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />

                              {/* Rename input or name */}
                              {isRenamingTask ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }} onClick={e => e.stopPropagation()}>
                                  <input
                                    ref={renameTaskRef}
                                    type="text"
                                    value={renameTaskValue}
                                    onChange={e => setRenameTaskValue(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRenameTask(t.id); if (e.key === 'Escape') setRenamingTaskId(null); }}
                                    style={inlineInputStyle}
                                  />
                                  <button onClick={() => handleRenameTask(t.id)} disabled={savingRenameTask} style={inlineBtnSave}>
                                    {savingRenameTask ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                  </button>
                                  <button onClick={() => setRenamingTaskId(null)} style={inlineBtnCancel}><X size={10} /></button>
                                </div>
                              ) : (
                                <span
                                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 500, color: t.status === 'obsolete' ? 'hsl(var(--text-muted))' : isSelected ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))', textDecoration: (isFrozen || t.status === 'obsolete') ? 'line-through' : 'none' }}
                                  title={isWorkedOn && t.status !== 'obsolete' ? 'Task đã có tiến độ — không thể đổi tên. Dùng "Hủy việc" và tạo lại.' : 'Double-click để đổi tên'}
                                  onDoubleClick={e => { e.stopPropagation(); if (canEdit && !isFrozen && t.status !== 'obsolete' && !isWorkedOn) { setRenamingTaskId(t.id); setRenameTaskValue(t.name); setTaskMenuId(null); } }}
                                >
                                  {t.name}
                                </span>
                              )}

                              {t.status === 'obsolete' && !isRenamingTask && (
                                <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 4px', flexShrink: 0 }}>Đã hủy</span>
                              )}

                              {!isRenamingTask && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))', flexShrink: 0 }}>
                                  {t.progress}%
                                </span>
                              )}

                              {/* Task context menu — only show ⋮ when task has NOT been worked on */}
                              {!isRenamingTask && canEdit && !isFrozen && t.status !== 'obsolete' && (
                                isWorkedOn ? (
                                  /* Locked indicator: 🔒 icon with tooltip */
                                  <span
                                    title="Task đã có tiến độ — chỉ có thể Hủy việc rồi tạo lại"
                                    style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', opacity: isHoveredTask ? 0.8 : 0, transition: 'opacity 0.13s', flexShrink: 0, userSelect: 'none' }}
                                  >
                                    🔒
                                  </span>
                                ) : (
                                  <div style={{ position: 'relative', opacity: isHoveredTask || showTaskMenu ? 1 : 0, transition: 'opacity 0.13s', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={e => { e.stopPropagation(); setTaskMenuId(showTaskMenu ? null : t.id); setPhaseMenuId(null); }}
                                      title="Tùy chọn"
                                      style={{ background: 'transparent', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', padding: 0 }}
                                    >
                                      <MoreVertical size={10} />
                                    </button>

                                    {showTaskMenu && (
                                      <div style={{ position: 'absolute', right: 0, top: '22px', zIndex: 200, backgroundColor: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: '155px', overflow: 'hidden' }}>
                                        <div
                                          style={menuItemStyle}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--primary-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setRenamingTaskId(t.id); setRenameTaskValue(t.name); setTaskMenuId(null); }}
                                        >
                                          <Pencil size={12} style={{ color: 'hsl(var(--primary))' }} /><span>Đổi tên Task</span>
                                        </div>
                                        <div
                                          style={{ ...menuItemStyle, color: 'hsl(var(--danger))' }}
                                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'hsl(var(--danger-glow))'}
                                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                                          onClick={() => { setTaskMenuId(null); handleDeleteTask(t.id, t.name); }}
                                        >
                                          <Trash2 size={12} /><span>Xóa hẳn Task</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}

                        {phaseTasks.length === 0 && !isAddingTaskHere && (
                          <div style={{ padding: '4px 10px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Chưa có task nào.</div>
                        )}

                        {/* Inline Add Task Form */}
                        {isAddingTaskHere && (
                          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px 10px', backgroundColor: 'hsl(var(--bg-main))', border: '1px dashed hsl(var(--primary) / 0.45)', borderRadius: 'var(--radius-sm)', marginTop: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                              <FilePlus2 size={12} /><span>Thêm Task vào "{ph.name}"</span>
                            </div>
                            <input ref={taskInputRef} type="text" placeholder="Tên công việc..." value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && newTaskDeadline) handleSaveTask(ph.id); if (e.key === 'Escape') { setAddingTaskForPhaseId(null); setNewTaskName(''); setNewTaskDeadline(''); } }}
                              style={{ ...inlineInputStyle, border: '1px solid hsl(var(--border))' }}
                            />
                            <input type="date" value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)}
                              style={{ ...inlineInputStyle, border: '1px solid hsl(var(--border))' }}
                            />
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                              <button onClick={() => { setAddingTaskForPhaseId(null); setNewTaskName(''); setNewTaskDeadline(''); }} style={inlineBtnCancel}><X size={11} /> Hủy</button>
                              <button onClick={() => handleSaveTask(ph.id)} disabled={savingTask} style={inlineBtnSave}>
                                {savingTask ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Tạo Task
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ── Add Phase inline ─────────────────────────── */}
              {canEdit && (
                <div style={{ marginTop: '8px' }}>
                  {!addingPhase ? (
                    <button
                      onClick={() => setAddingPhase(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '8px 12px', border: '1px dashed hsl(var(--border-light))', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', color: 'hsl(var(--text-muted))', fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s ease' }}
                      onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--primary))'; b.style.color = 'hsl(var(--primary))'; b.style.background = 'hsl(var(--primary-glow))'; }}
                      onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'hsl(var(--border-light))'; b.style.color = 'hsl(var(--text-muted))'; b.style.background = 'transparent'; }}
                    >
                      <FolderPlus size={14} /><span>+ Thêm Phase mới</span>
                    </button>
                  ) : (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '10px 12px', backgroundColor: 'hsl(var(--bg-main))', border: '1px dashed hsl(var(--primary) / 0.45)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>
                        <FolderPlus size={12} /><span>Tạo Giai đoạn (Phase) mới</span>
                      </div>
                      <input ref={phaseInputRef} type="text" placeholder="Ví dụ: Phase 4 – Hoàn thiện nội thất..." value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSavePhase(); if (e.key === 'Escape') { setAddingPhase(false); setNewPhaseName(''); } }}
                        style={{ ...inlineInputStyle, border: '1px solid hsl(var(--border))' }}
                      />
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setAddingPhase(false); setNewPhaseName(''); }} style={inlineBtnCancel}><X size={11} /> Hủy</button>
                        <button onClick={handleSavePhase} disabled={savingPhase} style={inlineBtnSave}>
                          {savingPhase ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Tạo Phase
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Right: Task detail ─────────────────────────── */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '4px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Chi tiết Công việc đang chọn
          </h4>

          {selectedTask ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedTask.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  Giai đoạn: <strong>{selectedTaskPhase?.name || 'Không xác định'}</strong>
                  {selectedTaskPhase?.status === 'frozen' && (
                    <span style={{ color: 'hsl(var(--danger))', marginLeft: '6px', fontWeight: 600 }}>[ĐÃ NGHIỆM THU - ĐÓNG BĂNG]</span>
                  )}
                </p>
              </div>

              {/* Progress */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span>Tiến độ hoàn thành:</span>
                  <span style={{ color: 'hsl(var(--primary))' }}>{selectedTask.progress}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'hsl(var(--border))', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${selectedTask.progress}%`, height: '100%', backgroundColor: selectedTask.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Assignee + Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                    <User size={14} />KỸ SƯ PHỤ TRÁCH
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.assignedName || 'Chưa phân công'}</strong>
                </div>
                <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                    <Calendar size={14} />HẠN HOÀN THÀNH
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.deadline}</strong>
                </div>
              </div>

              {/* Actions */}
              {project?.status === 'paused' || project?.status === 'done' ? (
                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'hsl(var(--danger-glow))', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.2)', fontSize: '0.85rem', color: 'hsl(var(--danger))' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>Dự án đang tạm dừng hoặc đã hoàn thành. Không thể thao tác.</span>
                </div>
              ) : selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {isTPKTOrPL && (
                    <>
                      <button onClick={() => setIsAssignOpen(true)} className="btn btn-secondary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}>
                        <UserPlus size={16} /><span>Phân công</span>
                      </button>
                      <button onClick={handleObsolete} className="btn" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px', backgroundColor: 'hsl(var(--bg-main))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                        <Trash2 size={16} /><span>Hủy việc</span>
                      </button>
                    </>
                  )}
                  {(user?.id === selectedTask.assignedTo || isTPKTOrPL) && (
                    <button onClick={() => setIsLogOpen(true)} className="btn btn-primary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '140px' }}>
                      <TrendingUp size={16} /><span>Cập nhật Nhật ký</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'hsl(var(--success-glow))', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--success) / 0.2)', fontSize: '0.85rem', color: 'hsl(var(--success))' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <CheckCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{selectedTask.status === 'obsolete' ? 'Công việc đã bị hủy bỏ.' : 'Phase này đã được nghiệm thu và khóa tiến độ.'}</span>
                  </div>
                  {selectedTask.status !== 'obsolete' && (
                    <button onClick={() => navigate(`/projects/${projectId}/phases/${selectedTask.phaseId}/acceptance`)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'fit-content', marginTop: '4px', borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))', backgroundColor: 'transparent' }}>
                      Xem chi tiết &amp; Hủy nghiệm thu
                    </button>
                  )}
                </div>
              )}

              {/* History logs */}
              <div onClick={() => setIsLogsOpen(true)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', flex: 1, cursor: 'pointer' }} title="Nhấp để xem nhật ký thi công chi tiết">
                <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                  <History size={13} />
                  <span>Nhật ký thi công chi tiết (Click để xem) ({selectedTask.history.length})</span>
                </h5>
                <div style={{ flex: 1, maxHeight: '160px', overflowY: 'auto', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', padding: '8px', pointerEvents: 'none' }}>
                  {selectedTask.history.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '12px', display: 'block', textAlign: 'center' }}>Chưa có lịch sử thay đổi nào.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedTask.history.map((h, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-muted))' }}>
                            <span>{h.date}</span><strong>{h.oldProgress}% → {h.newProgress}%</strong>
                          </div>
                          <p style={{ color: 'hsl(var(--text-primary))', marginTop: '2px', fontWeight: 500 }}>{h.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', margin: 'auto' }}>
              Vui lòng chọn một công việc bên sơ đồ cây để xem chi tiết.
            </div>
          )}
        </div>
      </div>

      {/* ─── Modals ─────────────────────────────────────── */}
      {isAssignOpen && selectedTask && (
        <AssignEngineerModal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} taskId={selectedTask.id} taskName={selectedTask.name} projectId={projectId} onSuccess={handleSuccess} onError={handleError} />
      )}

      {isLogsOpen && selectedTask && (
        <Modal isOpen={isLogsOpen} onClose={() => setIsLogsOpen(false)} title={`Nhật ký thi công chi tiết: ${selectedTask.name}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '60vh', overflowY: 'auto', padding: '4px' }}>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'hsl(var(--text-muted))' }}>Đang tải nhật ký...</div>
            ) : taskLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'hsl(var(--text-muted))' }}>Chưa có báo cáo nhật ký nào cho công việc này.</div>
            ) : taskLogs.map((log) => (
              <div key={log.id} style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', padding: '16px', backgroundColor: 'hsl(var(--bg-main) / 0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{log.engineerName}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '2px' }}>{log.date}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>
                    Tiến độ: {log.progressFrom}% → {log.progressTo}%
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: '1.4', color: 'hsl(var(--text-primary))' }}>{log.content}</p>
                {log.images && log.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {log.images.map((img, idx) => (
                      <div key={idx} style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
                        <img src={img} alt="Hiện trường" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
                {log.comments && log.comments.length > 0 && (
                  <div style={{ marginTop: '8px', borderTop: '1px solid hsl(var(--border) / 0.5)', paddingTop: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'block', marginBottom: '6px' }}>
                      Ý kiến chỉ đạo &amp; bình luận ({log.comments.length}):
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {log.comments.map((c) => (
                        <div key={c.id} style={{ padding: '6px 10px', backgroundColor: 'hsl(var(--bg-main) / 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px', color: 'hsl(var(--text-primary))' }}>
                            <span>{c.userName} ({c.role === 'tpkt' ? 'TP Kỹ Thuật' : c.role === 'admin' ? 'Admin' : c.role})</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 'normal', color: 'hsl(var(--text-muted))' }}>{c.date}</span>
                          </div>
                          <p style={{ margin: 0, color: 'hsl(var(--text-secondary))' }}>{c.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {isLogOpen && selectedTask && user && (
        <DailyLogFormModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} task={selectedTask} engineerId={user.id} engineerName={user.name} onSuccess={handleSuccess} onError={handleError} />
      )}
    </div>
  );
};
