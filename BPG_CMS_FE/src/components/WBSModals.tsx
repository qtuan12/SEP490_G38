import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { projectService } from '../services/projectService';
import type { WBSPhase, ProjectMember } from '../services/projectService';
import { Loader2 } from 'lucide-react';

// 1. CREATE NODE MODAL (Phase or Task)
interface CreateNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  phases: WBSPhase[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const CreateNodeModal: React.FC<CreateNodeModalProps> = ({
  isOpen,
  onClose,
  projectId,
  phases,
  onSuccess,
  onError
}) => {
  const [nodeType, setNodeType] = useState<'phase' | 'task'>('phase');
  const [name, setName] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (phases.length > 0) {
      setPhaseId(phases[0].id);
    }
  }, [phases]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError('Vui lòng nhập tên.');
      return;
    }

    setLoading(true);
    try {
      if (nodeType === 'phase') {
        await projectService.createPhase(projectId, name);
        onSuccess(`Đã tạo thành công Phase mới: ${name}`);
      } else {
        if (!phaseId) throw new Error('Vui lòng chọn Phase cha.');
        if (!deadline) throw new Error('Vui lòng chọn Hạn chót (Deadline).');
        await projectService.createTask({
          phaseId,
          projectId,
          name,
          deadline,
          sortOrder: 0
        });
        onSuccess(`Đã tạo thành công Công việc mới: ${name}`);
      }
      setName('');
      setDeadline('');
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi tạo đối tượng WBS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm phần tử WBS mới">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label>Loại cấu trúc</label>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer' }}>
              <input
                type="radio"
                name="nodeType"
                checked={nodeType === 'phase'}
                onChange={() => setNodeType('phase')}
                style={{ width: 'auto' }}
              />
              Giai đoạn mới (Phase)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer' }}>
              <input
                type="radio"
                name="nodeType"
                checked={nodeType === 'task'}
                onChange={() => setNodeType('task')}
                style={{ width: 'auto' }}
                disabled={phases.length === 0}
              />
              Công việc con (Task)
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="node-name">Tên hiển thị <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <input
            id="node-name"
            type="text"
            placeholder={nodeType === 'phase' ? "Ví dụ: Phase 4: Hoàn thiện nội thất" : "Ví dụ: Lát gạch nền sảnh chính"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {nodeType === 'task' && (
          <>
            <div>
              <label htmlFor="parent-phase">Thuộc Giai đoạn (Phase) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <select
                id="parent-phase"
                value={phaseId}
                onChange={(e) => setPhaseId(e.target.value)}
                required
              >
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id} disabled={ph.status === 'frozen'}>
                    {ph.name} {ph.status === 'frozen' ? '(Đã nghiệm thu - Đóng băng)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-deadline">Hạn chót hoàn thành (Deadline) <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="task-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Tạo mới'}
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
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const list = await projectService.getMembers(projectId);
        setMembers(list);
        if (list.length > 0) {
          setSelectedUserId(list[0].userId);
        }
      } catch (err) {
        console.error('Error fetching project members:', err);
      }
    };
    if (isOpen) fetchMembers();
  }, [isOpen, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      onError('Vui lòng chọn kỹ sư.');
      return;
    }

    setLoading(true);
    try {
      const selectedMember = members.find(m => m.userId === selectedUserId);
      if (!selectedMember) throw new Error('Không tìm thấy thành viên.');

      await projectService.updateTask(taskId, {
        assignedTo: selectedMember.userId,
        assignedName: selectedMember.userName
      });

      onSuccess(`Đã phân công ${selectedMember.userName} thực hiện việc "${taskName}"`);
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
          <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', marginBottom: '8px' }}>
            Phân công cho công việc: <strong>{taskName}</strong>
          </p>
          <label htmlFor="assign-select">Chọn kỹ sư thi công</label>
          {members.length > 0 ? (
            <select
              id="assign-select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ height: '40px' }}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName} ({m.userRole})
                </option>
              ))}
            </select>
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


// 3. SHIFT DEADLINE MODAL
interface ShiftDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskName: string;
  currentDeadline: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const ShiftDeadlineModal: React.FC<ShiftDeadlineModalProps> = ({
  isOpen,
  onClose,
  taskId,
  taskName,
  currentDeadline,
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

    setLoading(true);
    try {
      await projectService.shiftDeadline(taskId, newDeadline, reason);
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
