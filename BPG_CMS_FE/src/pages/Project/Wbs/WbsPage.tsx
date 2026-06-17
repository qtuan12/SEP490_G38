import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { wbsService } from '../../../services/wbsService';
import { ChevronRight, ChevronDown, Plus, Edit, Trash2, Users, SlidersHorizontal, Info, AlertTriangle } from 'lucide-react';
import type { WbsTask } from '../../../types/wbs';

// Placeholder for Modals (to be implemented)
// import PhaseFormModal from './PhaseFormModal';
// import TaskFormModal from './TaskFormModal';
// import TaskProgressAdjustModal from './TaskProgressAdjustModal';
// import TaskAssignModal from './TaskAssignModal';
// import TaskDetailsDrawer from './TaskDetailsDrawer';

export default function WbsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const { data: wbsTree, isLoading } = useQuery({
    queryKey: ['wbsTree', projectId],
    queryFn: () => wbsService.getWbsTree(Number(projectId)),
    enabled: !!projectId
  });

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const renderTask = (task: WbsTask, level: number) => {
    const nodeId = `task-${task.taskId}`;
    const isExpanded = expandedNodes[nodeId];
    const hasChildren = task.subTasks && task.subTasks.length > 0;

    return (
      <React.Fragment key={nodeId}>
        <tr style={{ backgroundColor: level % 2 === 0 ? '#fafafa' : '#fff' }}>
          <td style={{ paddingLeft: `${level * 24 + 16}px`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasChildren ? (
              <button onClick={() => toggleExpand(nodeId)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            ) : (
              <span style={{ width: '16px' }}></span>
            )}
            <span style={{ fontWeight: 500 }}>{task.name}</span>
            {task.status === 'Obsolete' && <span style={{ color: 'red', fontSize: '12px', padding: '2px 4px', border: '1px solid red', borderRadius: '4px' }}>Obsolete</span>}
          </td>
          <td>{task.startDate}</td>
          <td>{task.endDate}</td>
          <td>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100px', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${task.progressPercent}%`, height: '100%', background: task.progressPercent === 100 ? '#4caf50' : '#2196f3' }}></div>
              </div>
              <span style={{ fontSize: '12px' }}>{task.progressPercent}%</span>
            </div>
          </td>
          <td>{task.status}</td>
          <td>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button title="Xem chi tiết" className="btn-icon"><Info size={14} /></button>
              <button title="Sửa Task" className="btn-icon"><Edit size={14} /></button>
              {task.progressPercent === 0 && <button title="Xóa Task" className="btn-icon"><Trash2 size={14} color="red" /></button>}
              <button title="Giao việc" className="btn-icon"><Users size={14} /></button>
              <button title="Điều chỉnh %" className="btn-icon"><SlidersHorizontal size={14} /></button>
              <button title="Thêm Task con" className="btn-icon"><Plus size={14} /></button>
              <button title="Lỗi thời" className="btn-icon"><AlertTriangle size={14} color="orange" /></button>
            </div>
          </td>
        </tr>
        {isExpanded && hasChildren && task.subTasks.map(subTask => renderTask(subTask, level + 1))}
      </React.Fragment>
    );
  };

  if (isLoading) return <div>Đang tải WBS...</div>;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Work Breakdown Structure (WBS)</h2>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={16} /> Tạo Phase Mới
        </button>
      </div>

      <div className="table-container">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
              <th style={{ padding: '12px' }}>Tên Hạng Mục / Công Việc</th>
              <th style={{ padding: '12px' }}>Ngày Bắt Đầu</th>
              <th style={{ padding: '12px' }}>Ngày Kết Thúc</th>
              <th style={{ padding: '12px' }}>Tiến Độ</th>
              <th style={{ padding: '12px' }}>Trạng Thái</th>
              <th style={{ padding: '12px' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {wbsTree?.phases.map(phase => {
              const nodeId = `phase-${phase.phaseId}`;
              const isExpanded = expandedNodes[nodeId];
              const hasChildren = phase.tasks && phase.tasks.length > 0;

              return (
                <React.Fragment key={nodeId}>
                  <tr style={{ background: '#e3f2fd', borderBottom: '1px solid #bbdefb' }}>
                    <td style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                      {hasChildren ? (
                        <button onClick={() => toggleExpand(nodeId)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      ) : (
                        <span style={{ width: '18px' }}></span>
                      )}
                      {phase.name}
                    </td>
                    <td style={{ padding: '12px' }}>{phase.startDate || '-'}</td>
                    <td style={{ padding: '12px' }}>{phase.endDate || '-'}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '100px', height: '8px', background: '#cfd8dc', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${phase.progressPercent}%`, height: '100%', background: phase.progressPercent === 100 ? '#4caf50' : '#1976d2' }}></div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{phase.progressPercent}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>{phase.status}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button title="Thêm Task" className="btn-icon"><Plus size={16} /></button>
                        {(!hasChildren || phase.tasks.every(t => t.progressPercent === 0)) && (
                          <>
                            <button title="Sửa Phase" className="btn-icon"><Edit size={16} /></button>
                            <button title="Xóa Phase" className="btn-icon"><Trash2 size={16} color="red" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && hasChildren && phase.tasks.map(task => renderTask(task, 1))}
                </React.Fragment>
              );
            })}
            {wbsTree?.phases.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>Chưa có WBS nào. Hãy tạo Phase đầu tiên.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
