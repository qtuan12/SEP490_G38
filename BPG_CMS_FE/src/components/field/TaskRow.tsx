import React from 'react';
import { Plus } from 'lucide-react';
import type { WBSTask } from '../../types/common';

export const formatAssignees = (task: WBSTask, currentUserId?: string): string => {
  if (!task.assignedTo) return 'Chưa gán';
  const ids = task.assignedTo.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return 'Chưa gán';
  const names = (task.assignedName || '').split(',').map(s => s.trim());
  const labels = ids.map((id, i) => (currentUserId && id === String(currentUserId)) ? 'Bạn' : (names[i] || 'N/A'));
  return labels.join(', ');
};

interface TaskRowProps {
  task: WBSTask;
  currentUserId?: string;
  canCreateLog: boolean;
  onOpen: () => void;
  onCreateLog: () => void;
  /** Chỉ cần hiện tên người phụ trách khi danh sách có thể lẫn task của nhiều người (view project-wide của TM/PL).
   *  Site Engineer chỉ thấy task của chính mình nên hiện "Bạn" lặp lại mọi dòng là thừa. */
  showAssignee?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({ task, currentUserId, canCreateLog, onOpen, onCreateLog, showAssignee = true }) => {
  const assigneeLabel = formatAssignees(task, currentUserId);
  const unassigned = assigneeLabel === 'Chưa gán';

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-[hsl(var(--bg-main))] border border-[hsl(var(--border))]">
      <button onClick={onOpen} className="flex-1 text-left min-w-0">
        <div className="text-sm font-medium truncate text-[hsl(var(--text-primary))]">{task.name}</div>
        <div className="flex items-center gap-1.5 text-xs mt-0.5">
          <span className="text-[hsl(var(--text-muted))]">{task.progress}% hoàn thành</span>
          {showAssignee && (
            <>
              <span className="text-[hsl(var(--text-muted))]">&middot;</span>
              <span className={`truncate ${unassigned ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--text-muted))]'}`}>
                {assigneeLabel}
              </span>
            </>
          )}
        </div>
      </button>
      {canCreateLog && (
        <button
          onClick={onCreateLog}
          className="shrink-0 h-9 px-3 rounded-md bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))] text-xs font-semibold inline-flex items-center gap-0.5"
        >
          <Plus size={13} />
          Nhật ký
        </button>
      )}
    </div>
  );
};
