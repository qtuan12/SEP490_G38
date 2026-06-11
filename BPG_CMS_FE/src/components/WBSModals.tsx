import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { projectService } from '../services/projectService';
import type { WBSPhase, ProjectMember, PhaseMaterialItem } from '../services/projectService';
import { Loader2, Plus, Trash2 } from 'lucide-react';

// 1. CREATE TASK MODAL
interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phaseId: string;
  parentTaskId?: string;
  parentDeadline?: string;
  members: ProjectMember[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  projectId,
  phaseId,
  parentTaskId,
  parentDeadline,
  members,
  onSuccess,
  onError
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter only site engineers (Nhân viên kỹ thuật / SE)
  const engineers = members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'Nhân viên kỹ thuật');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError('Vui lòng nhập tên công việc.');
    if (!startDate) return onError('Vui lòng chọn ngày bắt đầu.');
    if (!deadline) return onError('Vui lòng chọn hạn chót (Deadline).');

    if (new Date(startDate) > new Date(deadline)) {
      return onError('Ngày bắt đầu không được lớn hơn hạn chót.');
    }

    if (parentDeadline && new Date(deadline) > new Date(parentDeadline)) {
      return onError(`Hạn chót không được vượt quá deadline của cấp cha (${parentDeadline}).`);
    }

    let assignedName = '';
    if (assignedTo) {
      const eng = engineers.find(e => e.userId === assignedTo);
      if (eng) assignedName = eng.userName;
    }

    setLoading(true);
    try {
      await projectService.createTask({
        phaseId,
        projectId,
        parentTaskId,
        name,
        description,
        startDate,
        deadline,
        assignedTo,
        assignedName,
        sortOrder: 0
      });
      onSuccess(`Đã tạo thành công Công việc: ${name}`);
      setName('');
      setDescription('');
      setStartDate('');
      setDeadline('');
      setAssignedTo('');
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi tạo Task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={parentTaskId ? "Thêm Công việc con (Sub-Task)" : "Thêm Công việc mới"}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div>
          <label>Tên công việc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input type="text" placeholder="Ví dụ: Đổ bê tông móng..." value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Mô tả chi tiết</label>
          <textarea placeholder="Mô tả các yêu cầu kỹ thuật, vị trí..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-main))' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label>Ngày bắt đầu dự kiến <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label>Ngày kết thúc (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </div>
        </div>
        <div>
          <label>Người phụ trách (Kỹ sư)</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">-- Chưa phân công --</option>
            {engineers.map(e => (
              <option key={e.userId} value={e.userId}>{e.userName}</option>
            ))}
          </select>
          {engineers.length === 0 && <div style={{ fontSize: '0.8rem', color: 'hsl(var(--warning))', marginTop: '4px' }}>* Không có kỹ sư nào trong dự án này.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Tạo Công việc'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: import('../services/projectService').WBSTask;
  parentDeadline?: string;
  members: ProjectMember[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  onClose,
  task,
  parentDeadline,
  members,
  onSuccess,
  onError
}) => {
  const [name, setName] = useState(task.name || '');
  const [description, setDescription] = useState(task.description || '');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [assignedTo, setAssignedTo] = useState(task.assignedTo || '');
  const [loading, setLoading] = useState(false);

  // Filter only site engineers (Nhân viên kỹ thuật / SE)
  const engineers = members.filter(m => m.userRole === 'Site Engineer' || m.userRole === 'kỹ sư' || m.userRole === 'Nhân viên kỹ thuật');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return onError('Vui lòng nhập tên công việc.');
    if (!startDate) return onError('Vui lòng chọn ngày bắt đầu.');
    if (!deadline) return onError('Vui lòng chọn hạn chót (Deadline).');

    if (new Date(startDate) > new Date(deadline)) {
      return onError('Ngày bắt đầu không được lớn hơn hạn chót.');
    }

    if (parentDeadline && new Date(deadline) > new Date(parentDeadline)) {
      return onError(`Hạn chót không được vượt quá deadline của cấp cha (${parentDeadline}).`);
    }

    let assignedName = '';
    if (assignedTo) {
      const eng = engineers.find(e => e.userId === assignedTo);
      if (eng) assignedName = eng.userName;
    }

    setLoading(true);
    try {
      await projectService.updateTask(task.id, {
        name,
        description,
        startDate,
        deadline,
        assignedTo,
        assignedName
      });
      onSuccess(`Đã cập nhật công việc: ${name}`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi cập nhật Task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa Công việc">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div>
          <label>Tên công việc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input type="text" placeholder="Ví dụ: Đổ bê tông móng..." value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Mô tả chi tiết</label>
          <textarea placeholder="Mô tả các yêu cầu kỹ thuật, vị trí..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-main))' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label>Ngày bắt đầu dự kiến <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label>Ngày kết thúc (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </div>
        </div>
        <div>
          <label>Người phụ trách (Kỹ sư)</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">-- Chưa phân công --</option>
            {engineers.map(e => (
              <option key={e.userId} value={e.userId}>{e.userName}</option>
            ))}
          </select>
          {engineers.length === 0 && <div style={{ fontSize: '0.8rem', color: 'hsl(var(--warning))', marginTop: '4px' }}>* Không có kỹ sư nào trong dự án này.</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
};


// 2. ASSIGN ENGINEER MODAL
interface AssignEngineerModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  projectId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const AssignEngineerModal: React.FC<AssignEngineerModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  projectId,
  onSuccess,
  onError
}) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const list = await projectService.getMembers(projectId);
        setMembers(list);
        
        // Fetch task to get current assignees
        const tasksList = await projectService.getTasks(projectId);
        const task = tasksList.find(t => t.id === taskId);
        if (task && task.assignedTo) {
          setSelectedUserIds(task.assignedTo.split(',').filter(Boolean));
        }
      } catch (err) {
        console.error('Error fetching assignment details:', err);
      }
    };
    if (isOpen) fetchDetails();
  }, [isOpen, projectId, taskId]);

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      onError('Vui lòng chọn ít nhất một kỹ sư.');
      return;
    }

    setLoading(true);
    try {
      const selectedMembers = members.filter(m => selectedUserIds.includes(m.userId));
      const assignedToVal = selectedUserIds.join(',');
      const assignedNameVal = selectedMembers.map(m => m.userName).join(', ');

      await projectService.updateTask(taskId, {
        assignedTo: assignedToVal,
        assignedName: assignedNameVal
      });

      onSuccess(`Đã phân công công việc "${taskName}" cho các kỹ sư: ${assignedNameVal}`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi phân công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân công Kỹ sư thực hiện">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '12px' }}>
            Phân công cho công việc: <strong>{taskName}</strong>
          </p>
          <label style={{ marginBottom: '8px', display: 'block' }}>Chọn danh sách kỹ sư thi công</label>
          
          {members.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              backgroundColor: 'hsl(var(--bg-main) / 0.3)'
            }}>
              {members.map((m) => {
                const isChecked = selectedUserIds.includes(m.userId);
                return (
                  <label key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.9rem', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleUser(m.userId)}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <span>{m.userName} ({m.userRole})</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '12px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
              Dự án chưa có thành viên kỹ sư nào để gán. Hãy thêm thành viên trước.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading || members.length === 0}>
            Xác nhận gán
          </button>
        </div>
      </form>
    </Modal>
  );
};


// 3. ADJUST DEADLINE MODAL
interface AdjustDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  currentDeadline: string;
  user: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const AdjustDeadlineModal: React.FC<AdjustDeadlineModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  currentDeadline,
  user,
  onSuccess,
  onError
}) => {
  const [newDeadline, setNewDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNewDeadline(currentDeadline);
  }, [currentDeadline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeadline) {
      onError('Vui lòng chọn ngày mới.');
      return;
    }
    if (!reason.trim()) {
      onError('Vui lòng nhập lý do dời hạn chót.');
      return;
    }
    if (newDeadline === currentDeadline) {
      onError('Ngày mới phải khác ngày hiện tại.');
      return;
    }

    setLoading(true);
    try {
      await projectService.adjustTaskDeadline(taskId, newDeadline, reason.trim(), user);
      onSuccess(`Đã dời hạn chót việc "${taskName}" sang ngày ${newDeadline}`);
      setReason('');
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi dời hạn chót.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yêu cầu dời Hạn chót (Deadline)">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
            Công việc: <strong>{taskName}</strong>
          </p>
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>
            Hạn chót hiện tại: <strong>{currentDeadline}</strong>
          </p>
        </div>

        <div>
          <label htmlFor="new-deadline-picker">Chọn hạn chót mới <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input
            id="new-deadline-picker"
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="shift-reason">Lý do dời hạn (Bắt buộc) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <textarea
            id="shift-reason"
            placeholder="Ví dụ: Do trời mưa bão dầm dề 3 ngày liên tiếp không thể thi công kết cấu cốt thép dầm sàn..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Xác nhận dời hạn
          </button>
        </div>
      </form>
    </Modal>
  );
};

// 4. CREATE PHASE POPUP MODAL WITH TIMELINE & MATERIALS
interface CreatePhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const CreatePhaseModal: React.FC<CreatePhaseModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onSuccess,
  onError
}) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError('Vui lòng nhập tên Phase.');
      return;
    }
    if (!startDate) {
      onError('Vui lòng chọn ngày bắt đầu.');
      return;
    }
    if (!endDate) {
      onError('Vui lòng chọn ngày kết thúc.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      onError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    setLoading(true);
    try {
      await projectService.createPhase(projectId, name.trim(), startDate, endDate, []);
      onSuccess(`Đã tạo thành công Phase mới: ${name.trim()}`);
      setName('');
      setStartDate('');
      setEndDate('');
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi tạo Phase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Giai đoạn (Phase) mới">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div>
          <label htmlFor="phase-name">Tên Giai đoạn <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input
            id="phase-name"
            type="text"
            placeholder="Ví dụ: Phase 4: Hoàn thiện nội thất"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="start-date">Ngày bắt đầu dự kiến <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }} />
          </div>
          <div>
            <label htmlFor="end-date">Ngày kết thúc (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Tạo Phase'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface EditPhaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: import('../services/projectService').WBSPhase;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const EditPhaseModal: React.FC<EditPhaseModalProps> = ({
  isOpen,
  onClose,
  phase,
  onSuccess,
  onError
}) => {
  const [name, setName] = useState(phase.name || '');
  const [startDate, setStartDate] = useState(phase.startDate || '');
  const [endDate, setEndDate] = useState(phase.deadline || phase.endDate || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError('Vui lòng nhập tên Phase.');
      return;
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      onError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    setLoading(true);
    try {
      await projectService.updatePhase(phase.id, {
        name: name.trim(),
        startDate: startDate || undefined,
        deadline: endDate || undefined,
        endDate: endDate || undefined
      });
      onSuccess(`Đã cập nhật Phase: ${name.trim()}`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi cập nhật Phase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chỉnh sửa Giai đoạn (Phase)">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div>
          <label>Tên Giai đoạn <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label>Ngày bắt đầu dự kiến</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }} />
          </div>
          <div>
            <label>Ngày kết thúc (Deadline)</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))', width: '100%' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ─── PHASE BOQ MODAL ───
interface PhaseBOQModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  hasActiveMRs?: boolean;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const PhaseBOQModal: React.FC<PhaseBOQModalProps> = ({
  isOpen,
  onClose,
  phase,
  hasActiveMRs,
  onSuccess,
  onError
}) => {
  const [materials, setMaterials] = useState<PhaseMaterialItem[]>(
    phase.materials && phase.materials.length > 0
      ? phase.materials
      : [{ name: '', quantity: 1, unit: 'bao' }]
  );
  const [loading, setLoading] = useState(false);

  // Sync state if phase changes while modal is open
  useEffect(() => {
    if (isOpen) {
      setMaterials(
        phase.materials && phase.materials.length > 0
          ? phase.materials
          : [{ name: '', quantity: 1, unit: 'bao' }]
      );
    }
  }, [isOpen, phase]);

  const handleAddItem = () => {
    setMaterials([...materials, { name: '', quantity: 1, unit: 'bao' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (materials.length === 1) return;
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validMaterials = materials
      .map(it => ({ ...it, name: it.name.trim() }))
      .filter(it => it.name !== '');

    setLoading(true);
    try {
      await projectService.updatePhaseMaterials(phase.id, validMaterials);
      onSuccess(`Đã cập nhật Bảng vật tư BOQ cho Phase: ${phase.name}`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi cập nhật BOQ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cập nhật Bảng vật tư BOQ: ${phase.name}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        
        <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--primary-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          Bạn đang chỉnh sửa định mức vật tư dự kiến cho <strong>{phase.name}</strong>. Các kỹ sư khi yêu cầu vật tư cho công việc thuộc Phase này sẽ bị giới hạn bởi số lượng trong bảng này.
        </div>

        {hasActiveMRs && (
          <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--danger-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))' }}>
            ⚠️ <strong>Đã có Yêu cầu vật tư</strong> cho Giai đoạn này. Không thể tùy tiện thay đổi Định mức (BOQ) để tránh sai lệch kiểm soát. Việc thay đổi BOQ lúc này cần lập tờ trình xin Giám đốc phê duyệt ngoài luồng.
          </div>
        )}

        <div>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span>Danh sách vật tư định mức (BOQ) <span style={{ color: 'hsl(var(--danger))' }}>*</span></span>
            {!hasActiveMRs && (
              <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={12} /><span>Thêm vật tư</span>
              </button>
            )}
          </label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {materials.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Tên vật tư (VD: Xi măng PCB40)..." 
                  value={item.name} 
                  onChange={e => handleItemChange(idx, 'name', e.target.value)}
                  disabled={hasActiveMRs}
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: hasActiveMRs ? 'hsl(var(--bg-main) / 0.5)' : 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  required
                />
                <input 
                  type="number" 
                  min={1} 
                  placeholder="SL" 
                  value={item.quantity} 
                  onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                  disabled={hasActiveMRs}
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: hasActiveMRs ? 'hsl(var(--bg-main) / 0.5)' : 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  required
                />
                <input 
                  type="text" 
                  placeholder="ĐVT" 
                  value={item.unit} 
                  onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                  disabled={hasActiveMRs}
                  style={{ fontSize: '0.85rem', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: hasActiveMRs ? 'hsl(var(--bg-main) / 0.5)' : 'hsl(var(--bg-card))', color: 'hsl(var(--text-primary))' }}
                  required
                />
                {!hasActiveMRs && (
                  <button 
                    type="button" 
                    disabled={materials.length === 1}
                    onClick={() => handleRemoveItem(idx)}
                    className="btn" 
                    style={{ padding: '4px', backgroundColor: 'transparent', color: 'hsl(var(--danger))', cursor: materials.length === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Lưu Bảng BOQ'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ==========================================
// 6. LEADER APPROVAL MODAL (TỔNG HỢP SE REQUESTS)
// ==========================================
interface LeaderApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: WBSPhase;
  projectId: string;
  user: any;
  allMaterialRequests: import('../services/projectService').MaterialRequest[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const LeaderApprovalModal: React.FC<LeaderApprovalModalProps> = ({
  isOpen,
  onClose,
  phase,
  projectId,
  user,
  allMaterialRequests,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  
  const pendingRequests = allMaterialRequests.filter(r => r.phaseId === phase.id && r.status === 'pending_leader');

  useEffect(() => {
    // Select all by default
    setSelectedReqIds(pendingRequests.map(r => r.id));
  }, [pendingRequests.length]);

  const toggleSelect = (id: string) => {
    setSelectedReqIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Tính tổng lượng yêu cầu
  const mergedItems: Record<string, { quantity: number, unit: string }> = {};
  pendingRequests.filter(r => selectedReqIds.includes(r.id)).forEach(req => {
    req.items.forEach(item => {
      if (mergedItems[item.name]) {
        mergedItems[item.name].quantity += item.quantity;
      } else {
        mergedItems[item.name] = { quantity: item.quantity, unit: item.unit };
      }
    });
  });

  // Check Over BOQ
  let isOverBOQ = false;
  const overBOQWarnings: string[] = [];
  
  if (phase.materials && phase.materials.length > 0) {
    Object.keys(mergedItems).forEach(matName => {
      const requestedQty = mergedItems[matName].quantity;
      const boqItem = phase.materials!.find(m => m.name === matName);
      
      // Calculate already requested/approved quantity from Phase
      const usedQty = allMaterialRequests
        .filter(r => r.phaseId === phase.id && r.status !== 'rejected' && r.status !== 'pending_leader')
        .reduce((sum, r) => {
          const item = r.items.find(i => i.name === matName);
          return sum + (item ? item.quantity : 0);
        }, 0);
        
      const totalRequested = usedQty + requestedQty;

      if (!boqItem) {
        isOverBOQ = true;
        overBOQWarnings.push(`Vật tư "${matName}" không có trong định mức BOQ.`);
      } else if (totalRequested > boqItem.quantity) {
        isOverBOQ = true;
        overBOQWarnings.push(`Vật tư "${matName}" vượt định mức. Yêu cầu đợt này + Đã xuất: ${totalRequested} > BOQ: ${boqItem.quantity}.`);
      }
    });
  } else if (Object.keys(mergedItems).length > 0) {
    isOverBOQ = true;
    overBOQWarnings.push('Phase này chưa thiết lập bảng định mức BOQ. Yêu cầu sẽ bị tính là vượt định mức.');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReqIds.length === 0) return onError('Vui lòng chọn ít nhất một yêu cầu để tổng hợp.');

    setLoading(true);
    try {
      await projectService.aggregateSERequests(
        selectedReqIds,
        phase.id,
        phase.name,
        user.name,
        isOverBOQ,
        reason
      );
      onSuccess('Tổng hợp đề xuất vật tư thành công và đã gửi Kế toán!');
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi tổng hợp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tổng hợp Yêu cầu Vật tư từ Kỹ sư">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
          Giai đoạn: <strong>{phase.name}</strong>
        </div>

        {pendingRequests.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            Không có yêu cầu vật tư nào đang chờ duyệt.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Danh sách Đề xuất (SE)</div>
              {pendingRequests.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', backgroundColor: 'hsl(var(--bg-main))', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedReqIds.includes(r.id)} 
                    onChange={() => toggleSelect(r.id)} 
                    style={{ marginTop: '4px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ fontSize: '0.85rem' }}>{r.requesterName}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>{r.date}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', marginTop: '4px' }}>
                      <strong>Task:</strong> {r.taskName || 'Không xác định'}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      <strong>Vật tư:</strong> {r.items.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: 'hsl(var(--primary-glow) / 0.5)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Tổng số lượng (Dự kiến)</div>
              {Object.keys(mergedItems).length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Chưa chọn yêu cầu nào.</span>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(mergedItems).map(([name, data]) => (
                    <div key={name} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: 'hsl(var(--bg-card))', borderRadius: 'var(--radius-sm)' }}>
                      <span>{name}</span>
                      <strong style={{ color: 'hsl(var(--primary))' }}>{data.quantity} {data.unit}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isOverBOQ && (
              <div style={{ fontSize: '0.85rem', backgroundColor: 'hsl(var(--danger-glow))', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--danger) / 0.3)' }}>
                <span style={{ color: 'hsl(var(--danger))', fontWeight: 600 }}>⚠️ Cảnh báo Vượt Định mức (Over BOQ)</span>
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: 'hsl(var(--danger))' }}>
                  {overBOQWarnings.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
                <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'hsl(var(--danger))' }}>
                  *Phiếu này sẽ được gửi lên Giám đốc phê duyệt thay vì Kế toán.
                </div>
              </div>
            )}

            <div>
              <label>Ghi chú / Giải trình (Nếu có)</label>
              <textarea 
                placeholder="Ví dụ: Xin duyệt tổng hợp vật tư cho tuần 1..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)} 
                rows={2} 
                style={{ width: '100%', padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--bg-main))' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={loading || selectedReqIds.length === 0}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Gửi Yêu cầu Tổng hợp'}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
};


