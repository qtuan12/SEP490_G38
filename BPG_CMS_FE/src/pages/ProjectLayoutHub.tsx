import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../services/projectService';
import { ProjectMembers } from '../components/ProjectMembers';
import { WBSWorkspace } from '../components/WBSWorkspace';
import { DailyLogFeed } from '../components/DailyLogFeed';
import { 
  ArrowLeft, 
  Users, 
  FolderGit2, 
  History, 
  MapPin, 
  Calendar,
  Loader2
} from 'lucide-react';

export const ProjectLayoutHub: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'wbs' | 'feed'>('wbs');

  const fetchProjectDetails = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await projectService.getProjectById(projectId);
      setProject(data);
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // Handle reload when tabs perform updates
  const handleTabUpdate = () => {
    fetchProjectDetails();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '10px' }}>
        <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
        <span>Đang tải thông tin không gian làm việc...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <h3>Không tìm thấy dự án</h3>
        <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Quay lại danh sách dự án
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Back button and Info header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button 
          onClick={() => navigate('/projects')} 
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
          <span>Quay lại danh sách dự án</span>
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{project.name}</h1>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                {project.address}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={14} style={{ color: 'hsl(var(--text-muted))' }} />
                Hạn: {project.startDate} ~ {project.endDate}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress display */}
      <div className="glass-panel" style={{
        padding: '24px 32px',
        background: 'linear-gradient(135deg, hsl(var(--bg-card-glass)) 0%, hsl(var(--primary-glow) / 0.1) 100%)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
            TIẾN ĐỘ TỔNG THỂ DỰ ÁN WBS
          </span>
          <strong style={{ fontSize: '2.2rem', fontWeight: 900, color: 'hsl(var(--primary))', letterSpacing: '-0.02em' }}>
            {project.progress}%
          </strong>
        </div>

        {/* Large Progress bar */}
        <div style={{ 
          height: '20px', 
          backgroundColor: 'hsl(var(--border))', 
          borderRadius: 'var(--radius-full)', 
          overflow: 'hidden',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{ 
            width: `${project.progress}%`, 
            height: '100%', 
            background: 'linear-gradient(90deg, hsl(var(--primary-hover)) 0%, hsl(var(--primary)) 100%)',
            boxShadow: '0 0 10px hsl(var(--primary) / 0.5)',
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid hsl(var(--border))', 
        gap: '8px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setActiveTab('members')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'members' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'members' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'members' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Users size={18} />
          <span>Thành viên dự án</span>
        </button>

        <button
          onClick={() => setActiveTab('wbs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wbs' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'wbs' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'wbs' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <FolderGit2 size={18} />
          <span>Kế hoạch WBS</span>
        </button>

        <button
          onClick={() => setActiveTab('feed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'feed' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            color: activeTab === 'feed' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
            fontWeight: activeTab === 'feed' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all var(--transition-fast)'
          }}
        >
          <History size={18} />
          <span>Dòng thời gian Nhật ký</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div 
        className="animate-fade-in" 
        style={{ marginTop: '10px' }}
        onClick={handleTabUpdate} // sync state updates when clicking inside tabs
      >
        {activeTab === 'members' && <ProjectMembers projectId={project.id} />}
        {activeTab === 'wbs' && <WBSWorkspace projectId={project.id} />}
        {activeTab === 'feed' && <DailyLogFeed projectId={project.id} />}
      </div>

    </div>
  );
};
