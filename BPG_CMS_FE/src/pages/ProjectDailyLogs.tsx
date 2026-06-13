import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DailyLogFeed } from '../components/DailyLogFeed';
import { TaskProgressHistoryPanel } from '../components/TaskProgressHistoryPanel';
import { Drawer } from '../components/ui';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import { projectService } from '../services/projectService';
import type { Project } from '../types/common';

export const ProjectDailyLogs: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId?: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [taskName, setTaskName] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (projectId) {
      projectService.getProjectById(projectId).then(setProject).catch(console.error);
    }
    if (projectId && taskId) {
      projectService.getTasks(projectId).then(tasks => {
        const found = tasks.find(t => t.id === taskId || t.id.replace(/^t-/, '') === taskId.replace(/^t-/, ''));
        if (found) setTaskName(found.name);
      }).catch(console.error);
    }
  }, [projectId, taskId]);

  if (!projectId) return null;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: 'hsl(var(--text-secondary))',
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} />
          <span>Quay lại Kế hoạch WBS</span>
        </button>

        {/* Nút mở drawer lịch sử — chỉ hiện khi đang xem theo task */}
        {taskId && (
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '7px 14px' }}
          >
            <BarChart2 size={15} />
            Lịch sử tiến độ
          </button>
        )}
      </div>

      {project && (
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {taskId ? `Nhật ký công việc: ${taskName || 'Đang tải...'}` : `Nhật ký thi công: ${project.name}`}
        </h2>
      )}

      {/* Feed chiếm toàn bộ chiều rộng — không cần layout grid nữa */}
      <DailyLogFeed projectId={projectId} taskId={taskId} />

      {/* Drawer lịch sử tiến độ — slide từ phải, bottom sheet trên mobile */}
      {taskId && (
        <Drawer
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          title={`Lịch sử tiến độ${taskName ? `: ${taskName}` : ''}`}
          width="420px"
        >
          <TaskProgressHistoryPanel taskId={taskId} taskName={taskName || undefined} />
        </Drawer>
      )}
    </div>
  );
};
