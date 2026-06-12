import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DailyLogFeed } from '../components/DailyLogFeed';
import { ArrowLeft } from 'lucide-react';
import { projectService } from '../services/projectService';
import type { Project } from '../services/projectService';

export const ProjectDailyLogs: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (projectId) {
      projectService.getProjectById(projectId).then(setProject).catch(console.error);
    }
  }, [projectId]);

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
          Nhật ký thi công: {project.name}
        </h2>
      )}

      <DailyLogFeed projectId={projectId} />
    </div>
  );
};
