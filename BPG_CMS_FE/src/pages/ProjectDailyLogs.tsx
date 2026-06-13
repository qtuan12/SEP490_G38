import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DailyLogFeed } from '../components/DailyLogFeed';
import { ArrowLeft } from 'lucide-react';
import { projectService } from '../services/projectService';
import type { Project } from '../types/common';

export const ProjectDailyLogs: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId?: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [taskName, setTaskName] = useState<string>('');

  useEffect(() => {
    if (projectId) {
      projectService.getProjectById(projectId).then(setProject).catch(console.error);
    }
    if (projectId && taskId) {
      projectService.getTasks(projectId).then(tasks => {
        const found = tasks.find(t => t.id === taskId || t.id.replace(/^t-/, '') === taskId.replace(/^t-/, ''));
        if (found) {
          setTaskName(found.name);
        }
      }).catch(console.error);
    }
  }, [projectId, taskId]);

  if (!projectId) return null;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <button 
        onClick={() => navigate(`/projects/${projectId}`)} 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          background: 'none', 
          border: 'none', 
          color: 'hsl(var(--text-secondary))', 
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 500,
          width: 'fit-content'
        }}
      >
        <ArrowLeft size={16} />
        <span>Quay lại Kế hoạch WBS</span>
      </button>

      {project && (
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          {taskId ? `Nhật ký công việc: ${taskName || 'Đang tải...'}` : `Nhật ký thi công: ${project.name}`}
        </h2>
      )}

      <DailyLogFeed projectId={projectId} taskId={taskId} />
    </div>
  );
};
