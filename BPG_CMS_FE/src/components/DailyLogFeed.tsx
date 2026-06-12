import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { projectService } from '../services/projectService';
import type {DailyLog, WBSTask} from '../types/common';
import { 
  Clock, 
  Send, 
  MessageSquare, 
  Eye, 
  Search, 
  Image as ImageIcon, 
  AlertTriangle, 
  CheckCircle, 
  ClipboardList 
} from 'lucide-react';
import { Modal } from './Modal';

interface DailyLogFeedProps {
  projectId: string;
}

export const DailyLogFeed: React.FC<DailyLogFeedProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [tasks, setTasks] = useState<WBSTask[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedEngineerId, setSelectedEngineerId] = useState('');
  const [filterWithImages, setFilterWithImages] = useState(false);
  const [filterWithIncidents, setFilterWithIncidents] = useState(false);

  // Acknowledged Comments State (Simulated on client-side via localStorage for simplicity)
  const [acknowledgedComments, setAcknowledgedComments] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('bpg_acknowledged_comments') || '[]');
    } catch {
      return [];
    }
  });

  // Comment inputs
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Image Zoom Modal State
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const logsData = await projectService.getDailyLogs(projectId);
      setLogs(logsData);
      
      const tasksData = await projectService.getTasks(projectId);
      setTasks(tasksData.filter(t => t.status !== 'obsolete'));
    } catch (err: any) {
      console.error('Error loading daily logs data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
      
      // Reload to show updated comments
      const logsData = await projectService.getDailyLogs(projectId);
      setLogs(logsData);
    } catch (err: any) {
      alert(err.message || 'Không thể gửi bình luận.');
    }
  };

  const handleAcknowledgeComment = (commentId: string) => {
    const updated = [...acknowledgedComments, commentId];
    setAcknowledgedComments(updated);
    localStorage.setItem('bpg_acknowledged_comments', JSON.stringify(updated));
  };

  // Extract unique engineers from logs
  const uniqueEngineers = React.useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach(log => {
      if (log.engineerId && log.engineerName) {
        map.set(log.engineerId, log.engineerName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [logs]);

  // Apply filters in memory
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query (check content, engineerName, taskName)
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        log.content.toLowerCase().includes(q) || 
        log.taskName.toLowerCase().includes(q) || 
        log.engineerName.toLowerCase().includes(q);

      // 2. Task filter
      const matchesTask = !selectedTaskId || log.taskId === selectedTaskId;

      // 3. Engineer filter
      const matchesEngineer = !selectedEngineerId || log.engineerId === selectedEngineerId;

      // 4. Image filter
      const matchesImage = !filterWithImages || (log.images && log.images.length > 0);

      // 5. Incident filter (progress decreases)
      const matchesIncident = !filterWithIncidents || (log.progressTo < log.progressFrom);

      return matchesSearch && matchesTask && matchesEngineer && matchesImage && matchesIncident;
    });
  }, [logs, searchQuery, selectedTaskId, selectedEngineerId, filterWithImages, filterWithIncidents]);

  // Group logs by date (YYYY-MM-DD)
  const groupedLogs = React.useMemo(() => {
    const groups: Record<string, DailyLog[]> = {};
    filteredLogs.forEach(log => {
      // Date is format "YYYY-MM-DD HH:MM", extract YYYY-MM-DD
      const dateKey = log.date.split(' ')[0] || 'Chưa rõ ngày';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });

    return Object.entries(groups)
      .sort((a, b) => b[0].localeCompare(a[0])) // newer dates first
      .map(([date, items]) => ({ date, items }));
  }, [filteredLogs]);

  // Calculate stats based on filtered logs
  const stats = React.useMemo(() => {
    let imageCount = 0;
    let incidentCount = 0;
    let directiveCount = 0;

    filteredLogs.forEach(log => {
      imageCount += log.images?.length || 0;
      if (log.progressTo < log.progressFrom) {
        incidentCount++;
      }
      log.comments.forEach(comment => {
        if ((comment.role === 'technicalmanager' || comment.role === 'director') && !acknowledgedComments.includes(comment.id)) {
          directiveCount++;
        }
      });
    });

    return {
      totalLogs: filteredLogs.length,
      totalImages: imageCount,
      totalIncidents: incidentCount,
      pendingDirectives: directiveCount
    };
  }, [filteredLogs, acknowledgedComments]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'technicalmanager': return 'TP Kỹ Thuật';
      case 'siteengineer': return 'Kỹ Sư Hiện Trường';
      case 'director': return 'director';
      case 'accountant': return 'accountant';
      default: return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return 'badge-danger';
      case 'technicalmanager': return 'badge-primary';
      case 'siteengineer': return 'badge-success';
      case 'director': return 'badge-warning';
      case 'accountant': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (dateStr === today) {
      return 'Hôm nay, ' + dateStr;
    } else if (dateStr === yesterday) {
      return 'Hôm qua, ' + dateStr;
    }
    return dateStr;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Title & Header */}
      <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dòng thời gian Nhật ký Công trường</h3>
        <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>
          Xem và theo dõi lịch sử cập nhật thi công của dự án theo trục thời gian thực tế.
        </p>
      </div>

      {/* 1. STATS MINI-DASHBOARD */}
      <div className="timeline-stats-grid">
        <div className="timeline-stat-card">
          <div className="timeline-stat-icon-wrapper" style={{ backgroundColor: 'hsl(var(--primary-glow))', color: 'hsl(var(--primary))' }}>
            <ClipboardList size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val">{stats.totalLogs}</span>
            <span className="timeline-stat-label">Số Nhật ký</span>
          </div>
        </div>

        <div className="timeline-stat-card">
          <div className="timeline-stat-icon-wrapper" style={{ backgroundColor: 'hsl(var(--success-glow))', color: 'hsl(var(--success))' }}>
            <ImageIcon size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val">{stats.totalImages}</span>
            <span className="timeline-stat-label">Ảnh Thực Địa</span>
          </div>
        </div>

        <div className="timeline-stat-card" style={{ borderColor: stats.totalIncidents > 0 ? 'hsl(var(--danger) / 0.3)' : 'hsl(var(--border))' }}>
          <div className="timeline-stat-icon-wrapper" style={{ 
            backgroundColor: stats.totalIncidents > 0 ? 'hsl(var(--danger-glow))' : 'hsl(var(--border) / 0.3)', 
            color: stats.totalIncidents > 0 ? 'hsl(var(--danger))' : 'hsl(var(--text-secondary))' 
          }}>
            <AlertTriangle size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val" style={{ color: stats.totalIncidents > 0 ? 'hsl(var(--danger))' : 'inherit' }}>
              {stats.totalIncidents}
            </span>
            <span className="timeline-stat-label">Số Sự Cố</span>
          </div>
        </div>

        <div className="timeline-stat-card" style={{ borderColor: stats.pendingDirectives > 0 ? 'hsl(var(--warning) / 0.3)' : 'hsl(var(--border))' }}>
          <div className="timeline-stat-icon-wrapper" style={{ 
            backgroundColor: stats.pendingDirectives > 0 ? 'hsl(var(--warning-glow))' : 'hsl(var(--border) / 0.3)', 
            color: stats.pendingDirectives > 0 ? 'hsl(var(--warning))' : 'hsl(var(--text-secondary))' 
          }}>
            <MessageSquare size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val" style={{ color: stats.pendingDirectives > 0 ? 'hsl(var(--warning))' : 'inherit' }}>
              {stats.pendingDirectives}
            </span>
            <span className="timeline-stat-label">Chỉ đạo mới</span>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH BAR */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'hsl(var(--bg-card))' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Text Search */}
          <div style={{ flex: 2, minWidth: '200px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              type="text"
              placeholder="Tìm nội dung, công việc, kỹ sư..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', height: '38px' }}
            />
          </div>

          {/* Task Dropdown */}
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">Tất cả Công việc</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>{task.name}</option>
              ))}
            </select>
          </div>

          {/* Engineer Dropdown */}
          <div style={{ flex: 1, minWidth: '150px' }}>
            <select
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              style={{ height: '38px', fontSize: '0.85rem' }}
            >
              <option value="">Tất cả Kỹ sư</option>
              {uniqueEngineers.map(eng => (
                <option key={eng.id} value={eng.id}>{eng.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Checkbox filters */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', borderTop: '1px solid hsl(var(--border) / 0.5)', paddingTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={filterWithImages}
              onChange={(e) => setFilterWithImages(e.target.checked)}
              style={{ width: '15px', height: '15px' }}
            />
            <span>Có ảnh chụp hiện trường</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={filterWithIncidents}
              onChange={(e) => setFilterWithIncidents(e.target.checked)}
              style={{ width: '15px', height: '15px' }}
            />
            <span style={{ color: filterWithIncidents ? 'hsl(var(--danger))' : 'inherit', fontWeight: filterWithIncidents ? 600 : 'normal' }}>
              Sự cố / Rework (tiến độ giảm)
            </span>
          </label>
        </div>
      </div>

      {/* 3. TIMELINE LIST */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'hsl(var(--text-muted))' }}>
          Đang tải dòng thời gian...
        </div>
      ) : groupedLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))', border: '1px dashed hsl(var(--border))', borderRadius: 'var(--radius-md)' }}>
          <MessageSquare size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>Không có nhật ký thi công nào khớp với bộ lọc hiện tại.</p>
        </div>
      ) : (
        <div className="timeline-container">
          
          {/* Vertical Track Line */}
          <div className="timeline-track" />

          {/* Grouped Logs by Date */}
          {groupedLogs.map((group) => (
            <div key={group.date}>
              
              {/* Date Header */}
              <div className="timeline-date-header">
                <Clock size={14} />
                <span>{formatDateLabel(group.date)}</span>
              </div>

              {/* Items for this date */}
              {group.items.map((log) => {
                const isIncident = log.progressTo < log.progressFrom;
                const delta = log.progressTo - log.progressFrom;
                
                // Determine node color type
                let nodeClass = "timeline-node-info";
                if (isIncident) {
                  nodeClass = "timeline-node-danger";
                } else if (delta > 0) {
                  nodeClass = "timeline-node-success";
                }

                return (
                  <div key={log.id} className="timeline-item animate-fade-in">
                    
                    {/* Circle Node on Timeline Track */}
                    <div className={`timeline-node ${nodeClass}`} />

                    {/* Main Log Card */}
                    <div 
                      className="card" 
                      style={{ 
                        padding: '20px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '14px',
                        backgroundColor: 'hsl(var(--bg-card))',
                        border: isIncident ? '1.5px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--border))',
                        boxShadow: isIncident ? '0 4px 12px hsl(var(--danger-glow))' : 'var(--shadow-sm)'
                      }}
                    >
                      {/* Log Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: isIncident ? 'hsl(var(--danger-glow))' : 'hsl(var(--primary-glow))',
                            color: isIncident ? 'hsl(var(--danger))' : 'hsl(var(--primary))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem'
                          }}>
                            {log.engineerName.charAt(0)}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '0.9rem' }}>{log.engineerName}</strong>
                              <span className="badge badge-success" style={{ fontSize: '0.6rem', textTransform: 'none', padding: '2px 6px' }}>Kỹ sư hiện trường</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Clock size={11} />
                              {log.date.split(' ')[1] || ''}
                            </span>
                          </div>
                        </div>

                        {/* Progress changes */}
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>Thay đổi tiến độ</span>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: isIncident ? 'hsl(var(--danger))' : 'hsl(var(--success))', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <span>{log.progressFrom}%</span>
                            <span>&rarr;</span>
                            <span>{log.progressTo}%</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                              ({delta > 0 ? `+${delta}%` : `${delta}%`})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Task Info Row */}
                      <div style={{ 
                        backgroundColor: 'hsl(var(--bg-main))', 
                        padding: '8px 12px', 
                        borderRadius: 'var(--radius-sm)', 
                        fontSize: '0.8rem',
                        borderLeft: `3px solid ${isIncident ? 'hsl(var(--danger))' : 'hsl(var(--primary))'}`,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>Công việc: <strong style={{ color: 'hsl(var(--text-primary))' }}>{log.taskName}</strong></span>
                        {isIncident && <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Báo cáo sự cố</span>}
                      </div>

                      {/* Content Text */}
                      <p style={{ 
                        fontSize: '0.9rem', 
                        color: 'hsl(var(--text-primary))', 
                        lineHeight: 1.5, 
                        whiteSpace: 'pre-wrap',
                        margin: 0
                      }}>
                        {log.content}
                      </p>

                      {/* 3. PROGRESS DELTA VISUAL BAR */}
                      <div className="progress-delta-container">
                        <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Biểu đồ thay đổi công việc</span>
                        <div className="progress-delta-bar">
                          {/* Base Progress */}
                          <div 
                            className="progress-delta-fill-base"
                            style={{ width: `${Math.min(log.progressFrom, log.progressTo)}%` }}
                          />
                          {/* Dynamic Delta portion */}
                          <div 
                            className={isIncident ? "progress-delta-fill-decrease" : "progress-delta-fill-increase"}
                            style={{ 
                              left: `${Math.min(log.progressFrom, log.progressTo)}%`,
                              width: `${Math.abs(delta)}%`
                            }}
                          />
                        </div>
                      </div>

                      {/* Images Grid */}
                      {log.images && log.images.length > 0 && (
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: log.images.length === 1 ? '1fr' : log.images.length === 2 ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))', 
                          gap: '8px',
                          marginTop: '4px'
                        }}>
                          {log.images.map((img, index) => (
                            <div 
                              key={index} 
                              style={{ 
                                borderRadius: 'var(--radius-md)', 
                                overflow: 'hidden', 
                                height: log.images.length === 1 ? '240px' : '120px',
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
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              />
                              <div style={{
                                position: 'absolute',
                                bottom: '6px',
                                right: '6px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                color: 'white',
                                padding: '4px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Eye size={10} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ 
                        marginTop: '6px', 
                        borderTop: '1px solid hsl(var(--border) / 0.5)', 
                        paddingTop: '12px' 
                      }}>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MessageSquare size={13} />
                          <span>Ý kiến Chỉ đạo & Bình luận ({log.comments?.length || 0})</span>
                        </h4>

                        {(log.comments?.length || 0) > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                            {log.comments.map((comm) => {
                              const isManager = comm.role === 'technicalmanager' || comm.role === 'director';
                              const isAcknowledged = acknowledgedComments.includes(comm.id);
                              
                              let commentClass = "";
                              if (isManager) {
                                commentClass = "comment-highlight-manager";
                              }
                              if (isAcknowledged) {
                                commentClass += " comment-acknowledged";
                              }

                              return (
                                <div 
                                  key={comm.id} 
                                  className={commentClass}
                                  style={{ 
                                    display: 'flex', 
                                    gap: '10px', 
                                    padding: '8px 12px', 
                                    backgroundColor: 'hsl(var(--bg-main) / 0.4)', 
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.825rem',
                                    border: '1px solid hsl(var(--border) / 0.5)',
                                    transition: 'all var(--transition-fast)'
                                  }}
                                >
                                  <div style={{
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    backgroundColor: isManager ? 'hsl(var(--warning-glow))' : 'hsl(var(--border))',
                                    color: isManager ? 'hsl(var(--warning))' : 'hsl(var(--text-primary))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    flexShrink: 0
                                  }}>
                                    {comm.userName.charAt(0)}
                                  </div>
                                  
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span>
                                        <strong style={{ marginRight: '6px' }}>{comm.userName}</strong>
                                        <span className={`badge ${getRoleBadgeClass(comm.role)}`} style={{ fontSize: '0.5rem', padding: '1px 5px', textTransform: 'none' }}>
                                          {getRoleLabel(comm.role)}
                                        </span>
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))' }}>{comm.date}</span>
                                    </div>
                                    <p style={{ color: 'hsl(var(--text-primary))', marginTop: '2px', lineHeight: 1.4 }}>
                                      {comm.content}
                                    </p>

                                    {isManager && !isAcknowledged && user?.role === 'siteengineer' && (
                                      <button
                                        onClick={() => handleAcknowledgeComment(comm.id)}
                                        className="btn btn-secondary"
                                        style={{ 
                                          alignSelf: 'flex-start',
                                          padding: '2px 6px',
                                          fontSize: '0.65rem',
                                          marginTop: '6px',
                                          height: '22px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          borderColor: 'hsl(var(--success) / 0.4)',
                                          color: 'hsl(var(--success))'
                                        }}
                                      >
                                        <CheckCircle size={10} />
                                        <span>Xác nhận đã đọc chỉ đạo</span>
                                      </button>
                                    )}

                                    {isManager && isAcknowledged && (
                                      <span style={{ 
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '0.65rem',
                                        color: 'hsl(var(--success))',
                                        fontWeight: 600,
                                        marginTop: '4px'
                                      }}>
                                        <CheckCircle size={10} />
                                        <span>Đã ghi nhận chỉ đạo</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {user && (
                          <form onSubmit={(e) => handleCommentSubmit(e, log.id)} style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="Nhập ý kiến chỉ đạo trực tuyến của Ban lãnh đạo..."
                              value={commentInputs[log.id] || ''}
                              onChange={(e) => handleCommentChange(log.id, e.target.value)}
                              style={{ height: '36px', fontSize: '0.8rem', flex: 1 }}
                              required
                            />
                            <button 
                              type="submit" 
                              className="btn btn-primary" 
                              style={{ width: '36px', height: '36px', padding: 0, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
                            >
                              <Send size={13} />
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
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



