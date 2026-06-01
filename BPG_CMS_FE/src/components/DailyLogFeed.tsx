import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type { DailyLog } from '../services/projectService';
import { Clock, Send, MessageSquare, CloudSun, Eye } from 'lucide-react';
import { Modal } from './Modal';

interface DailyLogFeedProps {
  projectId: string;
}

export const DailyLogFeed: React.FC<DailyLogFeedProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Comment states
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Image Zoom Modal State
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await projectService.getDailyLogs(projectId);
      setLogs(data);
    } catch (err: any) {
      console.error('Error loading daily logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  const handleCommentChange = (logId: string, value: string) => {
    setCommentInputs(prev => ({ ...prev, [logId]: value }));
  };

  const handleCommentSubmit = async (e: React.FormEvent, logId: string) => {
    e.preventDefault();
    if (!user) return;
    
    const content = commentInputs[logId]?.trim();
    if (!content) return;

    try {
      await projectService.addLogComment(logId, {
        id: user.id,
        name: user.name,
        role: user.role
      }, content);

      // Clear input
      setCommentInputs(prev => ({ ...prev, [logId]: '' }));
      // Reload logs to show updated comments
      loadLogs();
    } catch (err: any) {
      alert(err.message || 'Không thể gửi bình luận.');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'tpkt': return 'TP Kỹ Thuật';
      case 'kỹ sư': return 'Kỹ Sư Hiện Trường';
      case 'giám đốc': return 'Giám Đốc';
      case 'kế toán': return 'Kế Toán';
      default: return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-danger';
      case 'tpkt': return 'badge-primary';
      case 'kỹ sư': return 'badge-success';
      case 'giám đốc': return 'badge-warning';
      case 'kế toán': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
        Đang tải dòng thời gian nhật ký...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '680px', margin: '0 auto' }}>
      
      <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dòng thời gian Nhật ký Công trường</h3>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
          Tổng hợp báo cáo kỹ thuật hàng ngày từ thực địa (Mới nhất ở trên cùng)
        </p>
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: 'var(--radius-md)' }}>
          <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>Chưa có báo cáo nhật ký thi công nào cho dự án này.</p>
        </div>
      ) : (
        logs.map((log) => (
          <div 
            key={log.id} 
            className="card animate-fade-in" 
            style={{ 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              backgroundColor: 'hsl(var(--bg-card))',
              border: '1px solid hsl(var(--border))'
            }}
          >
            {/* User Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'hsl(var(--primary-glow))',
                  color: 'hsl(var(--primary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}>
                  {log.engineerName.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{log.engineerName}</strong>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem', textTransform: 'none' }}>Kỹ sư hiện trường</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <Clock size={12} />
                    {log.date}
                  </span>
                </div>
              </div>

              {/* Progress tag */}
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Tiến độ công việc</span>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--primary))' }}>
                  {log.progressFrom}% &rarr; {log.progressTo}%
                </div>
              </div>
            </div>

            {/* Task Name Info */}
            <div style={{ 
              backgroundColor: 'hsl(var(--bg-main))', 
              padding: '10px 14px', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.85rem',
              borderLeft: '3px solid hsl(var(--primary))',
              fontWeight: 500
            }}>
              Công việc: <strong style={{ color: 'hsl(var(--text-primary))' }}>{log.taskName}</strong>
            </div>

            {/* Weather / Conditions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'hsl(var(--warning))', fontWeight: 600 }}>
              <CloudSun size={15} />
              <span>Thời tiết: {log.weather}</span>
            </div>

            {/* Content Text */}
            <p style={{ 
              fontSize: '0.925rem', 
              color: 'hsl(var(--text-primary))', 
              lineHeight: 1.5, 
              whiteSpace: 'pre-wrap',
              margin: '4px 0'
            }}>
              {log.content}
            </p>

            {/* Images Grid */}
            {log.images && log.images.length > 0 && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: log.images.length === 1 ? '1fr' : log.images.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(130px, 1fr))', 
                gap: '8px',
                marginTop: '6px'
              }}>
                {log.images.map((img, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      borderRadius: 'var(--radius-md)', 
                      overflow: 'hidden', 
                      height: log.images.length === 1 ? '300px' : '150px',
                      position: 'relative',
                      border: '1px solid hsl(var(--border))',
                      cursor: 'zoom-in'
                    }}
                    onClick={() => setZoomImage(img)}
                  >
                    <img 
                      src={img} 
                      alt={`Hiện trường ${index + 1}`} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-fast)' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      color: 'white',
                      padding: '4px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Eye size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments Area */}
            <div style={{ 
              marginTop: '12px', 
              borderTop: '1px solid hsl(var(--border) / 0.6)', 
              paddingTop: '16px' 
            }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MessageSquare size={14} />
                <span>Ý kiến Chỉ đạo & Bình luận ({log.comments.length})</span>
              </h4>

              {/* Comment list */}
              {log.comments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {log.comments.map((comm) => (
                    <div 
                      key={comm.id} 
                      style={{ 
                        display: 'flex', 
                        gap: '10px', 
                        padding: '10px 14px', 
                        backgroundColor: 'hsl(var(--bg-main) / 0.5)', 
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'hsl(var(--border))',
                        color: 'hsl(var(--text-primary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        flexShrink: 0
                      }}>
                        {comm.userName.charAt(0)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                          <span>
                            <strong style={{ marginRight: '6px' }}>{comm.userName}</strong>
                            <span className={`badge ${getRoleBadgeClass(comm.role)}`} style={{ fontSize: '0.55rem', padding: '1px 4px' }}>
                              {getRoleLabel(comm.role)}
                            </span>
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>{comm.date}</span>
                        </div>
                        <p style={{ color: 'hsl(var(--text-primary))', marginTop: '2px', lineHeight: 1.4 }}>
                          {comm.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment Input form */}
              {user && (
                <form onSubmit={(e) => handleCommentSubmit(e, log.id)} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Nhập ý kiến chỉ đạo trực tuyến của Ban lãnh đạo..."
                    value={commentInputs[log.id] || ''}
                    onChange={(e) => handleCommentChange(log.id, e.target.value)}
                    style={{ height: '38px', fontSize: '0.85rem', flex: 1 }}
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '38px', height: '38px', padding: 0, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                  >
                    <Send size={15} />
                  </button>
                </form>
              )}
            </div>
          </div>
        ))
      )}

      {/* IMAGE ZOOM MODAL */}
      <Modal isOpen={!!zoomImage} onClose={() => setZoomImage(null)} title="Ảnh hiện trường thực tế">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
          {zoomImage && (
            <img 
              src={zoomImage} 
              alt="Zoomed" 
              style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} 
            />
          )}
        </div>
      </Modal>

    </div>
  );
};
