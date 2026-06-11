import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/Modal';
import { AlertCircle, User, Calendar, UserPlus, Trash2, TrendingUp, CheckCircle, Box, History } from 'lucide-react';
import type {WBSTask, WBSPhase, Project, MaterialRequest} from '../../../types/common';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask: WBSTask;
  selectedTaskPhase: WBSPhase | null;
  project: Project | null;
  tasks: WBSTask[];
  user: any;
  materialRequests: MaterialRequest[];
  isTPKTOrPL: boolean;
  isPL: boolean;
  onAssignOpen: () => void;
  onLogOpen: () => void;
  onCreateMatReqOpen: (type: 'normal' | 'emergency') => void;
  onObsolete: () => void;
}

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  return colors[hash % colors.length];
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen, onClose, selectedTask, selectedTaskPhase, project, tasks, user, materialRequests, isTPKTOrPL, isPL,
  onAssignOpen, onLogOpen, onCreateMatReqOpen, onObsolete
}) => {
  const navigate = useNavigate();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết Công việc đang chọn" maxWidth="700px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{selectedTask.name}</h3>
          <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
            Giai đoạn: <strong>{selectedTaskPhase?.name || 'Không xác định'}</strong>
            {selectedTaskPhase?.status === 'frozen' && (
              <span style={{ color: 'hsl(var(--danger))', marginLeft: '6px', fontWeight: 600 }}>[ĐÃ NGHIỆM THU - ĐÓNG BĂNG]</span>
            )}
          </p>
        </div>

        {/* Check subtasks */}
        {(() => {
          const hasChildren = tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete');
          if (hasChildren) {
            return (
              <div style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--primary-glow))', border: '1px solid hsl(var(--primary) / 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                <strong style={{ color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={16} /> Công việc này có chứa công việc con
                </strong>
                <p style={{ margin: '4px 0 0 0', color: 'hsl(var(--text-secondary))' }}>Tiến độ của công việc này sẽ được tính trung bình tự động dựa trên mức độ hoàn thành của các công việc con bên trong nó.</p>
              </div>
            );
          }
          return null;
        })()}

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

        {/* Assignee + Start Date + Deadline */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
              <User size={14} />KỸ SƯ PHỤ TRÁCH
            </span>
            {selectedTask.assignedTo && selectedTask.assignedName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                {selectedTask.assignedTo.split(',').map((id, index) => {
                  const names = selectedTask.assignedName ? selectedTask.assignedName.split(', ') : [];
                  const name = names[index] || 'Kỹ sư';
                  const initials = getInitials(name);
                  const bgColor = getAvatarColor(id);
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: bgColor,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                        }}
                      >
                        {initials}
                      </div>
                      <strong style={{ fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>{name}</strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>Chưa phân công</strong>
            )}
          </div>
          <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
              <Calendar size={14} />NGÀY BẮT ĐẦU
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.startDate || 'Chưa xác định'}</strong>
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
                <button onClick={onAssignOpen} className="btn btn-secondary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}>
                  <UserPlus size={16} /><span>Phân công</span>
                </button>
                <button onClick={onObsolete} className="btn" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px', backgroundColor: 'hsl(var(--bg-main))', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                  <Trash2 size={16} /><span>Hủy việc</span>
                </button>
              </>
            )}
            {(user?.id === selectedTask.assignedTo || isTPKTOrPL) && !tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete') && (
              <button onClick={onLogOpen} className="btn btn-primary" style={{ fontSize: '0.85rem', flex: 1, minWidth: '140px' }}>
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
              <button onClick={() => navigate(`/projects/${project?.id}/phases/${selectedTask.phaseId}/acceptance`)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'fit-content', marginTop: '4px', borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))', backgroundColor: 'transparent' }}>
                Xem chi tiết & Hủy nghiệm thu
              </button>
            )}
          </div>
        )}

        {/* SE Đề xuất vật tư cho Leader */}
        <div style={{ backgroundColor: 'hsl(var(--primary-glow) / 0.3)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-primary))', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Box size={16} style={{ color: 'hsl(var(--primary))' }} />
              Đề xuất vật tư cho công việc
            </h4>
            {selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' && project?.status !== 'done' && (
              <button
                onClick={() => onCreateMatReqOpen('normal')}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                + Đề xuất Vật tư
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {materialRequests.filter(r => r.taskId === selectedTask.id && !r.taskName?.includes('[Rework]')).length > 0 ? (
              materialRequests.filter(r => r.taskId === selectedTask.id && !r.taskName?.includes('[Rework]')).map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '8px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{r.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}</span>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{r.date} - {r.requesterName}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {r.status === 'pending_leader' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Leader duyệt</span>}
                    {r.status === 'approved_by_leader' && <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>Đã tổng hợp</span>}
                    {r.status === 'pending_tpkt' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ TPKT</span>}
                    {r.status === 'pending_accountant' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Kế toán</span>}
                    {r.status === 'pending_director' && <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Chờ Giám đốc</span>}
                    {r.status === 'approved' && <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Đã duyệt</span>}
                    {r.status === 'rejected' && <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Bị từ chối</span>}
                  </div>
                </div>
              ))
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', padding: '12px', display: 'block', textAlign: 'center', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)' }}>
                Chưa có đề xuất vật tư nào cho công việc này.
              </span>
            )}
          </div>
        </div>

        {/* History logs */}
        <div onClick={() => navigate(`/projects/${project?.id}/logs`)} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', cursor: 'pointer' }} title="Nhấp để xem nhật ký thi công chi tiết">
          <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
            <History size={13} />
            <span>Nhật ký thi công chi tiết (Click để xem) ({selectedTask.history?.length || 0})</span>
          </h5>
          <div style={{ maxHeight: '160px', overflowY: 'auto', backgroundColor: 'hsl(var(--bg-main) / 0.3)', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', padding: '8px', pointerEvents: 'none' }}>
            {!selectedTask.history || selectedTask.history.length === 0 ? (
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
    </Modal>
  );
};
