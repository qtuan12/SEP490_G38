import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {WBSTask} from '../types/common';
import { DailyLogFormModal } from './Incidents/modals/DailyLogFormModal';
import { Modal } from '../components/ui/Modal';
import { DailyLogFeed } from '../components/DailyLogFeed';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Smartphone,
  CheckCircle,
  TrendingUp,
  History
} from 'lucide-react';

const getInitials = (name: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getAvatarColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];
  return colors[hash % colors.length];
};

export const TaskDetailSE: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [task, setTask] = useState<WBSTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal triggers
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isDetailedLogsOpen, setIsDetailedLogsOpen] = useState(false);

  const loadTaskData = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      // Find task by scanning all projects
      const projects = await projectService.getProjects();
      let foundTask: WBSTask | null = null;
      
      for (const p of projects) {
        const pTasks = await projectService.getTasks(p.id);
        const t = pTasks.find(item => item.id === taskId || item.id.replace(/^t-/, '') === taskId.replace(/^t-/, ''));
        if (t) {
          foundTask = t;
          break;
        }
      }

      setTask(foundTask);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải công việc.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTaskData();
  }, [taskId]);

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadTaskData();
  };

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '10px' }}>
        <span>Đang tải màn hình hiện trường...</span>
      </div>
    );
  }

  if (!task) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Không tìm thấy công việc thực địa này</h3>
        <button onClick={() => navigate('/dashboard')} className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Quay lại Bảng điều khiển
        </button>
      </div>
    );
  }

  // Circular progress calculations
  const radius = 60;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (task.progress / 100) * circumference;

  return (
    <div style={{
      maxWidth: '420px',
      margin: '0 auto',
      backgroundColor: 'hsl(var(--bg-card))',
      minHeight: '85vh',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      
      {/* Mobile Top Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'hsl(var(--bg-main) / 0.5)'
      }}>
        <button 
          onClick={() => navigate(`/projects/${task.projectId}`)} 
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'hsl(var(--text-secondary))' }}
        >
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'hsl(var(--text-primary))' }}>
          NHẬT KÝ THI CÔNG DÀNH CHO KỸ SƯ
        </span>
        <Smartphone size={16} style={{ marginLeft: 'auto', color: 'hsl(var(--text-muted))' }} />
      </div>

      {/* Mobile Content */}
      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Alert Panels */}
        {success && (
          <div className="animate-fade-in" style={{
            padding: '12px',
            backgroundColor: 'hsl(var(--success-glow))',
            border: '1px solid hsl(var(--success) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'hsl(142 70% 30%)',
            fontSize: '0.85rem',
            fontWeight: 500
          }}>
            {success}
          </div>
        )}

        {error && (
          <div className="animate-fade-in" style={{
            padding: '12px',
            backgroundColor: 'hsl(var(--danger-glow))',
            border: '1px solid hsl(var(--danger) / 0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'hsl(346 84% 35%)',
            fontSize: '0.85rem',
            fontWeight: 500
          }}>
            {error}
          </div>
        )}

        {/* Task Name Section */}
        <div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            TÊN CÔNG VIỆC HIỆN TRƯỜNG
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(var(--text-primary))', marginTop: '4px', lineHeight: 1.25 }}>
            {task.name}
          </h1>
        </div>

        {/* Circular Progress Gauge */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px 0' }}>
          <div style={{ position: 'relative', width: `${radius * 2}px`, height: `${radius * 2}px` }}>
            <svg height={radius * 2} width={radius * 2}>
              <circle
                stroke="hsl(var(--border))"
                fill="transparent"
                strokeWidth={strokeWidth}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke={task.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--primary))'}
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference + ' ' + circumference}
                style={{ strokeDashoffset, transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s ease' }}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                {task.progress}%
              </span>
              <span style={{ display: 'block', fontSize: '0.65rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600 }}>
                Tiến độ
              </span>
            </div>
          </div>
        </div>

        {/* Meta Info Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'hsl(var(--bg-main) / 0.5)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} style={{ color: 'hsl(var(--text-muted))' }} />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>HẠN HOÀN THÀNH</span>
              <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>{task.deadline}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid hsl(var(--border) / 0.6)', paddingTop: '10px' }}>
            <User size={18} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block' }}>KỸ SƯ CHỊU TRÁCH NHIỆM</span>
              {task.assignedTo && task.assignedName ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                  {task.assignedTo.split(',').map((id, index) => {
                    const names = task.assignedName ? task.assignedName.split(', ') : [];
                    const name = names[index] || 'siteengineer';
                    const initials = getInitials(name);
                    const bgColor = getAvatarColor(id);
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
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
                <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>Chưa gán kỹ sư</strong>
              )}
            </div>
          </div>
        </div>

        {/* Big Update Button (Locked if task completed or not assigned to user) */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {task.progress === 100 ? (
            <div style={{
              display: 'flex',
              gap: '8px',
              backgroundColor: 'hsl(var(--success-glow))',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--success) / 0.2)',
              fontSize: '0.9rem',
              color: 'hsl(var(--success))',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600
            }}>
              <CheckCircle size={20} />
              <span>CÔNG VIỆC ĐÃ HOÀN THÀNH 100%</span>
            </div>
          ) : (
            <button
              onClick={() => setIsLogOpen(true)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: 'var(--shadow-glow)',
                height: '56px'
              }}
            >
              <TrendingUp size={20} />
              <span>CẬP NHẬT TIẾN ĐỘ HÔM NAY</span>
            </button>
          )}

          <button
            onClick={() => navigate(`/projects/${task.projectId}/logs`)}
            className="btn btn-outline"
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.95rem',
              fontWeight: 600,
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <History size={16} />
            <span>XEM DÒNG NHẬT KÝ DỰ ÁN</span>
          </button>
        </div>

        {/* Brief History Roll */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <History size={14} />
              LỊCH SỬ GHI NHẬT KÝ GẦN NHẤT
            </h4>
            <button
              onClick={() => setIsDetailedLogsOpen(true)}
              style={{
                fontSize: '0.75rem',
                color: 'hsl(var(--primary))',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Xem chi tiết
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
            {task.history.length === 0 ? (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>Chưa có lịch sử cập nhật.</span>
            ) : (
              task.history.slice(0, 3).map((h, index) => (
                <div key={index} style={{ padding: '8px', backgroundColor: 'hsl(var(--bg-main) / 0.4)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span>{h.date}</span>
                    <span style={{ color: 'hsl(var(--primary))' }}>{h.oldProgress}% &rarr; {h.newProgress}%</span>
                  </div>
                  <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>{h.reason}</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* INTEGRATED FORM MODAL */}
      {isLogOpen && user && (
        <DailyLogFormModal
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          task={task}
          engineerId={user.id}
          engineerName={user.name}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* DETAILED DAILY LOGS FEED MODAL */}
      {isDetailedLogsOpen && (
        <Modal 
          isOpen={isDetailedLogsOpen} 
          onClose={() => setIsDetailedLogsOpen(false)} 
          title={`Nhật ký chi tiết: ${task.name}`}
          maxWidth="800px"
        >
          <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
            <DailyLogFeed projectId={task.projectId} taskId={task.id} />
          </div>
        </Modal>
      )}

    </div>
  );
};

