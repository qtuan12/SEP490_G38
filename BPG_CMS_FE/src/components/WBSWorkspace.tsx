import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { WBSPhase, WBSTask, Project } from '../services/projectService';
import { 
  CreateNodeModal, 
  AssignEngineerModal, 
  ShiftDeadlineModal 
} from './WBSModals';
import { DailyLogFormModal } from './DailyLogFormModal';
import { 
  Folder, 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Calendar, 
  History, 
  CheckCircle, 
  UserPlus, 
  CalendarClock, 
  TrendingUp,
  FileSignature,
  User,
  Trash2,
  AlertCircle
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const isTPKTOrPL = user?.role === 'tpkt' || user?.role === 'admin'; // Simulated Project Leader role check

  const loadWBSData = async () => {
    setLoading(true);
    try {
      const pList = await projectService.getPhases(projectId);
      const tList = await projectService.getTasks(projectId);
      const allProjs = await projectService.getProjects();
      setProject(allProjs.find(p => p.id === projectId) || null);
      
      setPhases(pList);
      setTasks(tList);

      // Expand all phases by default
      const expands: Record<string, boolean> = {};
      pList.forEach(p => {
        expands[p.id] = true;
      });
      setExpandedPhases(expands);

      // Select first task if available
      if (tList.length > 0 && !selectedTaskId) {
        setSelectedTaskId(tList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải cơ cấu WBS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWBSData();
  }, [projectId]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }));
  };

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

  // Check if a phase is ready for acceptance (all child tasks 100%)
  const isPhaseReadyForAcceptance = (phaseId: string) => {
    const phaseTasks = tasks.filter(t => t.phaseId === phaseId && t.status !== 'obsolete');
    if (phaseTasks.length === 0) return false;
    return phaseTasks.every(t => t.progress === 100);
  };

  const handleObsolete = async () => {
    const reason = prompt('Nhập lý do hủy bỏ công việc này:');
    if (!reason || reason.trim().length < 5) {
      handleError('Lý do hủy bỏ không hợp lệ (ít nhất 5 ký tự).');
      return;
    }
    try {
      await projectService.markTaskObsolete(selectedTask!.id, reason, { name: user?.name || '', role: user?.role || '' });
      handleSuccess('Đã đánh dấu hủy bỏ công việc.');
    } catch (err: any) {
      handleError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Alert panels */}
      {success && (
        <div className="animate-fade-in" style={{
          padding: '10px 14px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(142 70% 30%)',
          fontSize: '0.85rem'
        }}>
          {success}
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          padding: '10px 14px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.2)',
          borderRadius: 'var(--radius-sm)',
          color: 'hsl(346 84% 35%)',
          fontSize: '0.85rem'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Cơ cấu phân rã công việc (WBS)</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
            Quản lý các Giai đoạn (Phases) và Công việc con (Tasks)
          </p>
        </div>

        {isTPKTOrPL && project?.status !== 'paused' && project?.status !== 'done' && (
          <button 
            onClick={() => setIsCreateOpen(true)} 
            className="btn btn-primary"
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            <span>Thêm Phase/Task mới</span>
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* Left Side: WBS Tree Diagram */}
        <div className="card" style={{ padding: '20px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Sơ đồ hình cây Phase &rarr; Task
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', margin: 'auto' }}>Đang tải sơ đồ...</div>
          ) : phases.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
              Chưa có dữ liệu WBS. Hãy bấm vào nút Thêm ở trên để tạo.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {phases.map((ph) => {
                const phaseTasks = tasks.filter(t => t.phaseId === ph.id);
                const isExpanded = expandedPhases[ph.id];
                const isFrozen = ph.status === 'frozen';
                const readyForAcceptance = isPhaseReadyForAcceptance(ph.id) && !isFrozen;

                return (
                  <div key={ph.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    
                    {/* Phase item row */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '8px 12px', 
                        backgroundColor: isFrozen ? 'hsl(var(--success-glow) / 0.05)' : 'hsl(var(--bg-main) / 0.5)',
                        borderRadius: 'var(--radius-sm)',
                        border: isFrozen ? '1px solid hsl(var(--success) / 0.2)' : '1px solid hsl(var(--border))',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}
                    >
                      <button 
                        onClick={() => togglePhase(ph.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'hsl(var(--text-secondary))' }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>

                      <Folder size={16} style={{ color: isFrozen ? 'hsl(var(--success))' : 'hsl(var(--primary))' }} />
                      <span style={{ color: isFrozen ? 'hsl(var(--text-muted))' : 'hsl(var(--text-primary))', textDecoration: isFrozen ? 'line-through' : 'none' }}>
                        {ph.name}
                      </span>

                      {/* Badges for Phase */}
                      {isFrozen ? (
                        <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px', marginLeft: 'auto' }}>
                          Đã nghiệm thu
                        </span>
                      ) : readyForAcceptance ? (
                        <span 
                          className="badge badge-warning animate-fade-in" 
                          style={{ fontSize: '0.6rem', padding: '1px 5px', marginLeft: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                          onClick={() => {
                            if (isTPKTOrPL) {
                              navigate(`/projects/${projectId}/phases/${ph.id}/acceptance`);
                            }
                          }}
                          title="Click để tiến hành nghiệm thu"
                        >
                          <FileSignature size={10} />
                          <span>Chờ nghiệm thu</span>
                        </span>
                      ) : (
                        <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '1px 5px', marginLeft: 'auto' }}>
                          {phaseTasks.length} việc
                        </span>
                      )}
                    </div>

                    {/* Task children */}
                    {isExpanded && (
                      <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px dashed hsl(var(--border-light))', marginLeft: '20px', marginTop: '2px' }}>
                        {phaseTasks.map((t) => {
                          const isSelected = selectedTaskId === t.id;
                          return (
                            <div
                              key={t.id}
                              onClick={() => setSelectedTaskId(t.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-sm)',
                                border: isSelected ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                                backgroundColor: isSelected ? 'hsl(var(--primary-glow))' : 'transparent',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transition: 'all var(--transition-fast)',
                                opacity: t.status === 'obsolete' ? 0.6 : 1
                              }}
                            >
                              <FileText size={15} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' }} />
                              <span style={{ 
                                fontWeight: isSelected ? 600 : 500, 
                                color: t.status === 'obsolete' ? 'hsl(var(--text-muted))' : isSelected ? 'hsl(var(--primary-hover))' : 'hsl(var(--text-secondary))',
                                textDecoration: (isFrozen || t.status === 'obsolete') ? 'line-through' : 'none'
                              }}>
                                {t.name}
                              </span>
                              {t.status === 'obsolete' && (
                                <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 4px', marginLeft: '6px' }}>Đã hủy</span>
                              )}
                              <span style={{ 
                                marginLeft: 'auto', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' 
                              }}>
                                {t.progress}%
                              </span>
                            </div>
                          );
                        })}
                        {phaseTasks.length === 0 && (
                          <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                            Không có công việc nào trong Phase này.
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Detailed View */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '4px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
            Chi tiết Công việc đang chọn
          </h4>

          {selectedTask ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              {/* Task name & Phase parent */}
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedTask.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                  Giai đoạn: <strong>{selectedTaskPhase?.name || 'Không xác định'}</strong>
                  {selectedTaskPhase?.status === 'frozen' && (
                    <span style={{ color: 'hsl(var(--danger))', marginLeft: '6px', fontWeight: 600 }}>
                      [GIAI ĐOẠN ĐÃ NGHIỆM THU - ĐÓNG BĂNG]
                    </span>
                  )}
                </p>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span>Tiến độ hoàn thành:</span>
                  <span style={{ color: 'hsl(var(--primary))' }}>{selectedTask.progress}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'hsl(var(--border))', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${selectedTask.progress}%`, 
                    height: '100%', 
                    backgroundColor: selectedTask.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>

              {/* Grid details (Assignee & Deadline) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                    <User size={14} />
                    KỸ SƯ PHỤ TRÁCH
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>
                    {selectedTask.assignedName || 'Chưa phân công'}
                  </strong>
                </div>

                <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                    <Calendar size={14} />
                    HẠN HOÀN THÀNH
                  </span>
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>
                    {selectedTask.deadline}
                  </strong>
                </div>
              </div>

              {/* Quick Actions (only enabled if phase not frozen and task not obsolete) */}
              {project?.status === 'paused' || project?.status === 'done' ? (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: 'hsl(var(--danger-glow))',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--danger) / 0.2)',
                  fontSize: '0.85rem',
                  color: 'hsl(var(--danger))'
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>Dự án đang tạm dừng hoặc đã hoàn thành. Không thể thao tác công việc.</span>
                </div>
              ) : selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {/* TPKT / PL Actions */}
                  {isTPKTOrPL && (
                    <>
                      <button 
                        onClick={() => setIsAssignOpen(true)} 
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}
                      >
                        <UserPlus size={16} />
                        <span>Phân công</span>
                      </button>
                      <button 
                        onClick={() => setIsShiftOpen(true)} 
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}
                      >
                        <CalendarClock size={16} />
                        <span>Dời Deadline</span>
                      </button>
                      <button 
                        onClick={handleObsolete} 
                        className="btn"
                        style={{ 
                          fontSize: '0.85rem', flex: 1, minWidth: '120px', 
                          backgroundColor: 'hsl(var(--bg-main))', 
                          color: 'hsl(var(--danger))', 
                          border: '1px solid hsl(var(--danger) / 0.3)' 
                        }}
                      >
                        <Trash2 size={16} />
                        <span>Hủy việc</span>
                      </button>
                    </>
                  )}

                  {/* Log Report Action (only enabled if assigned user is logged in, or is TPKT/PL for demo) */}
                  {(user?.id === selectedTask.assignedTo || isTPKTOrPL) && (
                    <button 
                      onClick={() => setIsLogOpen(true)} 
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem', flex: 1, minWidth: '140px' }}
                    >
                      <TrendingUp size={16} />
                      <span>Cập nhật Nhật ký</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  backgroundColor: 'hsl(var(--success-glow))',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid hsl(var(--success) / 0.2)',
                  fontSize: '0.85rem',
                  color: 'hsl(var(--success))'
                }}>
                  <CheckCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{selectedTask.status === 'obsolete' ? 'Công việc đã bị hủy bỏ.' : 'Phase này đã được nghiệm thu và khóa tiến độ thành công.'}</span>
                </div>
              )}

              {/* Reschedule Log / Revision history */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', flex: 1 }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <History size={13} />
                  <span>Lịch sử cập nhật & dời hạn ({selectedTask.history.length})</span>
                </h5>
                <div style={{ 
                  flex: 1, 
                  maxHeight: '160px', 
                  overflowY: 'auto', 
                  backgroundColor: 'hsl(var(--bg-main) / 0.3)',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px'
                }}>
                  {selectedTask.history.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '12px', display: 'block', textAlign: 'center' }}>
                      Chưa có lịch sử thay đổi nào.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedTask.history.map((h, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', borderBottom: '1px solid hsl(var(--border) / 0.5)', paddingBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--text-muted))' }}>
                            <span>{h.date}</span>
                            <strong>{h.oldProgress}% &rarr; {h.newProgress}%</strong>
                          </div>
                          <p style={{ color: 'hsl(var(--text-primary))', marginTop: '2px', fontWeight: 500 }}>
                            {h.reason}
                          </p>
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

      {/* ALL MODALS SETUP */}
      {isCreateOpen && (
        <CreateNodeModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          projectId={projectId}
          phases={phases}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isAssignOpen && selectedTask && (
        <AssignEngineerModal
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          taskId={selectedTask.id}
          taskName={selectedTask.name}
          projectId={projectId}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isShiftOpen && selectedTask && (
        <ShiftDeadlineModal
          isOpen={isShiftOpen}
          onClose={() => setIsShiftOpen(false)}
          taskId={selectedTask.id}
          taskName={selectedTask.name}
          currentDeadline={selectedTask.deadline}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isLogOpen && selectedTask && user && (
        <DailyLogFormModal
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          task={selectedTask}
          engineerId={user.id}
          engineerName={user.name}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

    </div>
  );
};
