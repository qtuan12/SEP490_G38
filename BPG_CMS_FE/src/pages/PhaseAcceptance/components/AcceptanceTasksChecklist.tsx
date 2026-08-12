import React, { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CornerDownRight,
  Link2,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import type { WBSTask } from '../../../types/common';
import { getActivePhaseTasks } from '../../../utils/phaseAcceptance';

interface AcceptanceTasksChecklistProps {
  tasks: WBSTask[];
  allCompleted: boolean;
}

interface TaskTreeNode {
  task: WBSTask;
  children: TaskTreeNode[];
}

const taskOrder = (left: WBSTask, right: WBSTask) =>
  (left.sortOrder ?? 0) - (right.sortOrder ?? 0);

const buildTaskTree = (tasks: WBSTask[]): TaskTreeNode[] => {
  const taskIds = new Set(tasks.map((task) => task.id));
  const childrenByParent = new Map<string, WBSTask[]>();

  tasks.forEach((task) => {
    if (!task.parentTaskId || !taskIds.has(task.parentTaskId)) return;
    const children = childrenByParent.get(task.parentTaskId) ?? [];
    children.push(task);
    childrenByParent.set(task.parentTaskId, children);
  });

  const toNode = (task: WBSTask): TaskTreeNode => ({
    task,
    children: (childrenByParent.get(task.id) ?? [])
      .sort(taskOrder)
      .map(toNode),
  });

  return tasks
    .filter((task) => !task.parentTaskId || !taskIds.has(task.parentTaskId))
    .sort(taskOrder)
    .map(toNode);
};

export const AcceptanceTasksChecklist: React.FC<AcceptanceTasksChecklistProps> = ({
  tasks,
  allCompleted,
}) => {
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const taskTree = useMemo(() => buildTaskTree(tasks), [tasks]);
  const activeTasks = getActivePhaseTasks(tasks);
  const completedCount = activeTasks.filter((task) => task.progress === 100).length;
  const incompleteCount = activeTasks.length - completedCount;
  const obsoleteCount = tasks.length - activeTasks.length;

  const renderTask = (node: TaskTreeNode, depth = 0): React.ReactNode => {
    const { task, children } = node;
    const isObsolete = task.status === 'obsolete';
    const isCompleted = task.progress === 100;
    const predecessors = (task.predecessorTaskIds ?? []).map((id) => ({
      id: String(id),
      task: taskById.get(String(id)),
    }));

    return (
      <React.Fragment key={task.id}>
        <div
          style={{
            marginLeft: `${Math.min(depth, 6) * 28}px`,
            padding: '12px 14px',
            border: '1px solid hsl(var(--border))',
            borderLeft: depth > 0
              ? '3px solid hsl(var(--primary) / 0.45)'
              : '3px solid hsl(var(--border))',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isObsolete
              ? 'hsl(var(--bg-main) / 0.25)'
              : 'hsl(var(--bg-main) / 0.45)',
            opacity: isObsolete ? 0.72 : 1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', minWidth: 0 }}>
              {depth > 0 ? (
                <CornerDownRight size={17} style={{ color: 'hsl(var(--primary))', marginTop: '2px', flexShrink: 0 }} />
              ) : isObsolete ? (
                <PauseCircle size={18} style={{ color: 'hsl(var(--text-muted))', marginTop: '1px', flexShrink: 0 }} />
              ) : isCompleted ? (
                <CheckCircle2 size={18} style={{ color: 'hsl(var(--success))', marginTop: '1px', flexShrink: 0 }} />
              ) : (
                <XCircle size={18} style={{ color: 'hsl(var(--danger))', marginTop: '1px', flexShrink: 0 }} />
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'center' }}>
                  <span style={{ fontWeight: depth === 0 ? 700 : 600, overflowWrap: 'anywhere' }}>
                    {task.name}
                  </span>
                  {/* <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    {depth === 0
                      ? children.length > 0 ? '' : ''
                      : `Cấp con ${depth}`}
                  </span>
                  {isObsolete && (
                    <span className="badge" style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>

                    </span>
                  )} */}
                </div>

                {/* {predecessors.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center', marginTop: '8px', fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
                    <Link2 size={14} />
                    <span>Phụ thuộc:</span>
                    {predecessors.map(({ id, task: predecessor }) => (
                      <span
                        key={id}
                        title={!predecessor
                          ? 'Công việc tiên quyết không nằm trong danh sách của giai đoạn này'
                          : predecessor.status === 'obsolete'
                            ? 'Công việc tiên quyết đã tạm dừng'
                            : `Tiến độ: ${predecessor.progress}%`}
                        style={{
                          padding: '2px 7px',
                          borderRadius: '999px',
                          border: '1px solid hsl(var(--border))',
                          background: !predecessor || predecessor.status === 'obsolete'
                            ? 'hsl(var(--bg-main))'
                            : predecessor.progress === 100
                              ? 'hsl(var(--success-glow))'
                              : 'hsl(var(--warning-glow))',
                        }}
                      >
                        {predecessor
                          ? `${predecessor.name} · ${predecessor.status === 'obsolete' ? 'Tạm dừng' : `${predecessor.progress}%`}`
                          : `Task #${id} · ngoài giai đoạn`}
                      </span>
                    ))}
                  </div>
                )} */}
              </div>
            </div>

            <span className={`badge ${isObsolete ? '' : isCompleted ? 'badge-success' : 'badge-danger'}`} style={{ whiteSpace: 'nowrap' }}>
              {isObsolete ? 'Đã tạm dừng' : `${task.progress}%`}
            </span>
          </div>
        </div>

        {children.map((child) => renderTask(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="card">
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Danh sách công việc
      </h3>
      <p style={{ margin: '0 0 14px', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>

      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        <span className="badge badge-success">{completedCount}/{activeTasks.length}</span>

      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {taskTree.map((node) => renderTask(node))}
        {tasks.length === 0 && (
          <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
            Không tìm thấy công việc nào trong giai đoạn này.
          </p>
        )}
      </div>

      {!allCompleted && (
        <div style={{
          marginTop: '16px',
          display: 'flex',
          gap: '10px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.2)',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          color: 'hsl(346 84% 35%)',
          alignItems: 'center',
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Chưa đủ điều kiện nghiệm thu:</strong>{' '}
            {activeTasks.length === 0
              ? 'Giai đoạn phải còn ít nhất một công việc hoạt động.'
              : 'Tất cả công việc đang hoạt động phải đạt 100%.'}
          </span>
        </div>
      )}
    </div>
  );
};
