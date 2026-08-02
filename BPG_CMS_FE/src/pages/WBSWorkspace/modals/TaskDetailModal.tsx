import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { AlertCircle, User, Calendar, UserPlus, Trash2, TrendingUp, CheckCircle, Package, FileText, ArrowLeft, Users, RotateCcw } from 'lucide-react';
import { AssignEngineerForm } from './AssignEngineerModal';
import { AdjustProgressForm } from './AdjustProgressModal';
import { ObsoleteTaskForm } from './ObsoleteTaskModal';
import { DailyLogForm } from '../../ProjectDailyLogs/modals/DailyLogFormModal';
import type { WBSTask, WBSPhase, Project, MaterialRequest } from '../../../types/common';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { wbsService } from '../../../services/wbsService';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { canCreateDailyLog } from '../../../utils/taskPermissions';

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
  isTPKT: boolean;
  isPL: boolean;
  onCreateMatReqOpen: (type: 'normal' | 'emergency') => void;
  onObsolete: () => void;
  onReportIncidentOpen: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
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
  isOpen, onClose, selectedTask, selectedTaskPhase, project, tasks, user, isTPKTOrPL, isTPKT, isPL,
  onObsolete,
  onReportIncidentOpen,
  onSuccess, onError
}) => {
  const navigate = useNavigate();
  const [viewingRequest, setViewingRequest] = useState<MaterialRequest | null>(null);
  const [activeForm, setActiveForm] = useState<'assign' | 'adjust' | 'obsolete' | 'log' | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  const handleFormSuccess = (msg: string) => {
    setActiveForm(null);
    onSuccess && onSuccess(msg);
  };

  const handleFormError = (msg: string) => {
    if (onError) onError(msg);
  };

  const restoreMutation = useMutation({
    mutationFn: () => wbsService.restoreTask(parseInt(selectedTask.id.replace('t-', ''))),
    onSuccess: () => {
      toast.success('Đã khôi phục công việc thành công');
      setIsRestoreConfirmOpen(false);
      if (onSuccess) onSuccess('Đã khôi phục công việc thành công');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi khôi phục công việc');
      setIsRestoreConfirmOpen(false);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_leader': return <span className="badge badge-warning">Chờ Leader</span>;
      case 'approved_by_leader': return <span className="badge badge-info">Đã tổng hợp</span>;
      case 'pending_accountant': return <span className="badge badge-warning">Chờ phê duyệt</span>;
      case 'pending_disbursement': return <span className="badge badge-warning">Chờ tạm ứng</span>;
      case 'pending_director': return <span className="badge badge-warning">Chờ duyệt vượt định mức</span>;
      case 'approved': return <span className="badge badge-success">Đã phê duyệt</span>;
      case 'rejected': return <span className="badge badge-danger">Bị từ chối</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  if (viewingRequest) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết Yêu cầu Vật tư" maxWidth="750px">
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid hsl(var(--border))' }}>
            <button onClick={() => setViewingRequest(null)} className="btn btn-secondary" style={{ padding: '8px' }} title="Quay lại">
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem' }}>Yêu cầu vật tư bởi {viewingRequest.requesterName}</h3>
              <div style={{ display: 'flex', gap: '16px', color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {viewingRequest.date}</span>
              </div>
            </div>
            <div>
              {getStatusBadge(viewingRequest.status)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
              <Package size={18} /> Danh sách vật tư
            </h4>
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'hsl(var(--bg-main))' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>STT</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>Tên Vật tư</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>Số lượng</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' }}>ĐVT</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingRequest.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border-light))' }}>
                      <td style={{ padding: '12px 16px' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{item.name}</td>
                      <td style={{ padding: '12px 16px', color: 'hsl(var(--primary))', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ padding: '12px 16px', color: 'hsl(var(--text-secondary))' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(viewingRequest.reason || viewingRequest.rejectionReason) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {viewingRequest.reason && (
                <div style={{ padding: '16px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.95rem' }}>
                    <FileText size={16} /> Ghi chú / Giải trình
                  </strong>
                  <div style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {viewingRequest.reason}
                  </div>
                </div>
              )}
              {viewingRequest.rejectionReason && (
                <div style={{ padding: '16px', backgroundColor: 'hsl(var(--danger-glow))', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.95rem', color: 'hsl(var(--danger))' }}>
                    <AlertCircle size={16} /> Lý do từ chối
                  </strong>
                  <div style={{ fontSize: '0.9rem', color: 'hsl(var(--danger))', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {viewingRequest.rejectionReason}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const isParentTask = tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete');
  const canReportDailyLog = canCreateDailyLog(selectedTask, user, isPL) && !isParentTask;

  const isBlocked = (() => {
    const predIds = selectedTask.predecessorTaskIds;
    if (predIds && predIds.length > 0) {
      const preds = predIds.map(id => tasks.find(t => t.id === id.toString())).filter(Boolean).filter(p => p!.status !== 'obsolete');
      return preds.some(p => p!.progress < 100);
    }
    return false;
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết Công việc đang chọn" maxWidth={activeForm ? "1100px" : "700px"}>
      <div style={{ display: 'flex', flexDirection: window.innerWidth < 768 ? 'column' : 'row', gap: '24px', alignItems: 'flex-start', transition: 'all 0.3s' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', flex: activeForm ? '1 1 60%' : '1 1 100%' }}>
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

          {/* Check predecessor tasks */}
          {(() => {
            const predIds = selectedTask.predecessorTaskIds;
            if (predIds && predIds.length > 0) {
              const preds = predIds.map(id => tasks.find(t => t.id === id.toString())).filter(Boolean).filter(p => p!.status !== 'obsolete');
              if (preds.length === 0) return null;
              return (
                <div style={{ padding: '10px 14px', backgroundColor: 'hsl(var(--warning-glow) / 0.08)', border: '1px solid hsl(var(--warning) / 0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'hsl(var(--warning-text))', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <AlertCircle size={15} /> Công việc đi trước
                  </strong>
                  <p style={{ margin: 0, color: 'hsl(var(--text-secondary))' }}>
                    Cần hoàn thành 100% các công việc sau để có thể bắt đầu công việc này:
                  </p>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: 'hsl(var(--text-primary))', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {preds.map(p => (
                      <li key={p!.id} style={{ listStyleType: 'disc' }}>
                        <span style={{ fontWeight: 500 }}>{p!.name}</span>: {' '}
                        <span style={{ fontWeight: 600, color: p!.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--warning-text))' }}>
                          {p!.progress === 100 ? 'Đã xong (100%)' : `Chưa xong (${p!.progress}%)`}
                        </span>
                      </li>
                    ))}
                  </ul>
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

          {/* Assignee + Start Date + Deadline + Weight */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '16px' }}>
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
              <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.startDate?.split('-').reverse().join('-') || 'Chưa xác định'}</strong>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                <Calendar size={14} />HẠN HOÀN THÀNH
              </span>
              <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.deadline?.split('-').reverse().join('-')}</strong>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                <TrendingUp size={14} />MỨC ĐỘ QUAN TRỌNG
              </span>
              <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>
                {(() => {
                  const w = Number(selectedTask.weight);
                  if (w === 4) return 'Rất quan trọng';
                  if (w === 3) return 'Quan trọng';
                  if (w === 2) return 'Cao';
                  return 'Bình thường';
                })()}
              </strong>
            </div>
          </div>

          {selectedTask.isOutsourced && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, padding: '12px', backgroundColor: 'hsl(var(--warning-glow) / 0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed hsl(var(--warning) / 0.3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: '6px' }}>
                  <Users size={14} />ĐỘI THỢ / THẦU PHỤ NGOÀI
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))' }}>{selectedTask.outsourcedTeamName || 'Không rõ tên'}</strong>
                  {selectedTask.outsourcedTeamContact && (
                    <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                      SĐT liên hệ: {selectedTask.outsourcedTeamContact}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {project?.status !== 'inprogress' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', backgroundColor: 'hsl(var(--danger-glow))', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.2)', fontSize: '0.85rem', color: 'hsl(var(--danger))' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>
                  {project?.status === 'paused'
                    ? 'Dự án đang bị tạm dừng thi công không thể thao tác được'
                    : project?.status === 'done'
                    ? 'Dự án đã hoàn thành không thể thao tác được'
                    : 'Dự án đang là bản nháp không thể thao tác được'}
                </span>
              </div>
              <button 
                onClick={() => { onClose(); navigate(`/projects/${project?.id}/tasks/${selectedTask.id}/logs`); }} 
                className="btn btn-outline" 
                style={{ fontSize: '0.85rem', width: '100%', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', border: '1px solid hsl(var(--primary))', color: 'hsl(var(--primary))' }}
              >
                <FileText size={15} />
                <span>Xem Nhật ký thi công</span>
              </button>
            </div>
          ) : selectedTaskPhase?.status !== 'frozen' && selectedTask.status !== 'obsolete' ? (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {isTPKTOrPL && (
                <>
                  {!isParentTask && (
                    <button onClick={() => setActiveForm(activeForm === 'assign' ? null : 'assign')} className={`btn ${activeForm === 'assign' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px' }}>
                      <UserPlus size={16} /><span>Phân công</span>
                    </button>
                  )}
                  {isTPKT && !isParentTask && (
                    <button onClick={() => setActiveForm(activeForm === 'adjust' ? null : 'adjust')} className={`btn ${activeForm === 'adjust' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: '0.85rem', flex: 1, minWidth: '160px', borderColor: activeForm === 'adjust' ? undefined : 'hsl(var(--primary))', color: activeForm === 'adjust' ? undefined : 'hsl(var(--primary))' }} disabled={isBlocked}>
                      <TrendingUp size={16} /><span>Điều chỉnh tiến độ trực tiếp</span>
                    </button>
                  )}
                  <button onClick={() => {
                    if (selectedTask.progress > 0) {
                      setActiveForm(activeForm === 'obsolete' ? null : 'obsolete');
                    } else {
                      onObsolete();
                    }
                  }} className="btn" style={{ fontSize: '0.85rem', flex: 1, minWidth: '120px', backgroundColor: activeForm === 'obsolete' ? 'hsl(var(--danger))' : 'hsl(var(--bg-main))', color: activeForm === 'obsolete' ? '#fff' : 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                    <Trash2 size={16} /><span>{selectedTask.progress > 0 ? 'Tạm dừng công việc' : 'Xóa công việc'}</span>
                  </button>
                </>
              )}
              {canReportDailyLog && (
                <>
                  <button onClick={() => setActiveForm(activeForm === 'log' ? null : 'log')} className={`btn ${activeForm === 'log' ? 'btn-secondary' : 'btn-primary'}`} style={{ fontSize: '0.85rem', flex: 1, minWidth: '140px' }} disabled={isBlocked}>
                    <TrendingUp size={16} /><span>Cập nhật Nhật ký</span>
                  </button>
                </>
              )}
              <button 
                onClick={() => { onClose(); navigate(`/projects/${project?.id}/tasks/${selectedTask.id}/logs`); }} 
                className="btn btn-outline" 
                style={{ fontSize: '0.85rem', flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', border: '1px solid hsl(var(--primary))', color: 'hsl(var(--primary))', backgroundColor: 'hsl(var(--primary-glow))' }}
              >
                <FileText size={15} />
                <span>Xem Nhật ký thi công</span>
              </button>
              <button 
                onClick={() => onReportIncidentOpen()} 
                className="btn btn-outline" 
                style={{ fontSize: '0.85rem', flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', border: '1px solid hsl(var(--danger))', color: 'hsl(var(--danger))', backgroundColor: 'hsl(var(--danger-glow))' }}
              >
                <AlertCircle size={15} />
                <span>Báo cáo Sự cố</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(() => {
                const isCancelledByEmergencyIncident = selectedTask.status === 'obsolete' && (
                  selectedTask.obsoleteReason?.includes('Sự cố khẩn cấp') || selectedTask.obsoleteReason?.includes('Sự cố')
                );
                return (
                  <>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px', 
                      backgroundColor: isCancelledByEmergencyIncident ? 'hsl(var(--danger-glow))' : 'hsl(var(--success-glow))', 
                      padding: '12px', 
                      borderRadius: 'var(--radius-sm)', 
                      border: isCancelledByEmergencyIncident ? '1px solid hsl(var(--danger) / 0.2)' : '1px solid hsl(var(--success) / 0.2)', 
                      fontSize: '0.85rem', 
                      color: isCancelledByEmergencyIncident ? 'hsl(var(--danger))' : 'hsl(var(--success))' 
                    }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isCancelledByEmergencyIncident ? <AlertCircle size={16} style={{ flexShrink: 0 }} /> : <CheckCircle size={16} style={{ flexShrink: 0 }} />}
                        <span>
                          {selectedTask.status === 'obsolete' 
                            ? (isCancelledByEmergencyIncident 
                                ? 'Công việc đã bị hủy do sự cố khẩn cấp (theo phương án được Giám đốc phê duyệt) và không thể khôi phục.' 
                                : 'Công việc đã bị tạm dừng.') 
                            : 'Phase này đã được nghiệm thu và khóa tiến độ.'}
                        </span>
                      </div>
                      {selectedTask.status !== 'obsolete' && (
                        <button onClick={() => navigate(`/projects/${project?.id}/phases/${selectedTask.phaseId}/acceptance`)} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '4px 8px', width: 'fit-content', marginTop: '4px', borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))', backgroundColor: 'transparent' }}>
                          Xem chi tiết & Hủy nghiệm thu
                        </button>
                      )}
                    </div>
                    {selectedTask.status === 'obsolete' && !isCancelledByEmergencyIncident && isTPKTOrPL && (
                      <button 
                        onClick={() => setIsRestoreConfirmOpen(true)} 
                        className="btn" 
                        style={{ fontSize: '0.85rem', width: '100%', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', backgroundColor: 'hsl(var(--success))', color: '#fff' }}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw size={15} />
                        <span>{restoreMutation.isPending ? 'Đang xử lý...' : 'Khôi phục công việc'}</span>
                      </button>
                    )}
                  </>
                );
              })()}
              <button 
                onClick={() => { onClose(); navigate(`/projects/${project?.id}/tasks/${selectedTask.id}/logs`); }} 
                className="btn btn-outline" 
                style={{ fontSize: '0.85rem', width: '100%', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', border: '1px solid hsl(var(--primary))', color: 'hsl(var(--primary))' }}
              >
                <FileText size={15} />
                <span>Xem Nhật ký thi công</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Inline Forms Container */}
        {activeForm && (
          <div className="w-full animate-fade-in sticky top-0" style={{ flex: '1 1 40%' }}>
            {activeForm === 'assign' && (
              <AssignEngineerForm taskId={selectedTask.id} taskName={selectedTask.name} projectId={project?.id || ''} onSuccess={handleFormSuccess} onCancel={() => setActiveForm(null)} />
            )}
            {activeForm === 'adjust' && (
              <AdjustProgressForm task={selectedTask} onSuccess={handleFormSuccess} onError={handleFormError} onCancel={() => setActiveForm(null)} />
            )}
            {activeForm === 'obsolete' && (
              <ObsoleteTaskForm task={selectedTask} onSuccess={handleFormSuccess} onCancel={() => setActiveForm(null)} />
            )}
            {activeForm === 'log' && canReportDailyLog && (
              <DailyLogForm task={selectedTask} engineerId={user?.id} engineerName={user?.name || user?.userName} isPL={isPL} canManageTechnical={isTPKT} onSuccess={handleFormSuccess} onError={handleFormError} onCancel={() => setActiveForm(null)} />
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={() => restoreMutation.mutate()}
        title="Xác nhận khôi phục công việc"
        message={`Bạn có chắc chắn muốn khôi phục công việc "${selectedTask.name}" này không?`}
        confirmText="Khôi phục"
        cancelText="Hủy"
        isDanger={false}
        isLoading={restoreMutation.isPending}
      />
    </Modal>
  );
};

