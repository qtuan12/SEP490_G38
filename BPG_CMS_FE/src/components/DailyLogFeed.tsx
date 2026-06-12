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
import { Modal, Input, Select, Badge, Button } from './ui';
import type { BadgeVariant } from './ui';

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

  const getRoleBadgeVariant = (role: string): BadgeVariant => {
    switch (role) {
      case 'admin': return 'danger';
      case 'technicalmanager': return 'default'; // Using default since primary isn't available
      case 'siteengineer': return 'success';
      case 'director': return 'warning';
      case 'accountant': return 'default'; // Using default since primary isn't available
      default: return 'default';
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
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto pb-10">
      
      {/* Title & Header */}
      <div className="border-b border-[hsl(var(--border))] pb-3">
        <h3 className="text-[1.25rem] font-bold">Dòng thời gian Nhật ký Công trường</h3>
        <p className="text-[0.85rem] text-[hsl(var(--text-muted))] mt-1">
          Xem và theo dõi lịch sử cập nhật thi công của dự án theo trục thời gian thực tế.
        </p>
      </div>

      {/* 1. STATS MINI-DASHBOARD */}
      <div className="timeline-stats-grid">
        <div className="timeline-stat-card">
          <div className="timeline-stat-icon-wrapper bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]">
            <ClipboardList size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val">{stats.totalLogs}</span>
            <span className="timeline-stat-label">Số Nhật ký</span>
          </div>
        </div>

        <div className="timeline-stat-card">
          <div className="timeline-stat-icon-wrapper bg-[hsl(var(--success-glow))] text-[hsl(var(--success))]">
            <ImageIcon size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className="timeline-stat-val">{stats.totalImages}</span>
            <span className="timeline-stat-label">Ảnh Thực Địa</span>
          </div>
        </div>

        <div className={`timeline-stat-card ${stats.totalIncidents > 0 ? 'border-[hsl(var(--danger)/0.3)]' : 'border-[hsl(var(--border))]'}`}>
          <div className={`timeline-stat-icon-wrapper ${stats.totalIncidents > 0 ? 'bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--border)/0.3)] text-[hsl(var(--text-secondary))]'}`}>
            <AlertTriangle size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className={`timeline-stat-val ${stats.totalIncidents > 0 ? 'text-[hsl(var(--danger))]' : ''}`}>
              {stats.totalIncidents}
            </span>
            <span className="timeline-stat-label">Số Sự Cố</span>
          </div>
        </div>

        <div className={`timeline-stat-card ${stats.pendingDirectives > 0 ? 'border-[hsl(var(--warning)/0.3)]' : 'border-[hsl(var(--border))]'}`}>
          <div className={`timeline-stat-icon-wrapper ${stats.pendingDirectives > 0 ? 'bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))]' : 'bg-[hsl(var(--border)/0.3)] text-[hsl(var(--text-secondary))]'}`}>
            <MessageSquare size={20} />
          </div>
          <div className="timeline-stat-content">
            <span className={`timeline-stat-val ${stats.pendingDirectives > 0 ? 'text-[hsl(var(--warning))]' : ''}`}>
              {stats.pendingDirectives}
            </span>
            <span className="timeline-stat-label">Chỉ đạo mới</span>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH BAR */}
      <div className="card p-4 sm:p-5 flex flex-col gap-3 bg-[hsl(var(--bg-card))]">
        <div className="flex gap-3 flex-wrap items-center">
          
          {/* Text Search */}
          <div className="flex-[2] min-w-[200px] relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--text-muted))]" />
            <Input
              type="text"
              placeholder="Tìm nội dung, công việc, kỹ sư..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-[38px]"
            />
          </div>

          {/* Task Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <Select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="h-[38px] text-[0.85rem]"
              options={[
                { label: 'Tất cả Công việc', value: '' },
                ...tasks.map(t => ({ label: t.name, value: t.id }))
              ]}
            />
          </div>

          {/* Engineer Dropdown */}
          <div className="flex-1 min-w-[150px]">
            <Select
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              className="h-[38px] text-[0.85rem]"
              options={[
                { label: 'Tất cả Kỹ sư', value: '' },
                ...uniqueEngineers.map(e => ({ label: e.name, value: e.id }))
              ]}
            />
          </div>

        </div>

        {/* Checkbox filters */}
        <div className="flex gap-4 flex-wrap text-[0.85rem] text-[hsl(var(--text-secondary))] border-t border-[hsl(var(--border)/0.5)] pt-2.5">
        <label className="flex items-center gap-1.5 cursor-pointer m-0">
          <input
            type="checkbox"
            checked={filterWithImages}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterWithImages(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          <span>Có ảnh chụp hiện trường</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer m-0">
          <input
            type="checkbox"
            checked={filterWithIncidents}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFilterWithIncidents(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          <span className={filterWithIncidents ? "text-[hsl(var(--danger))] font-semibold" : ""}>
            Sự cố / Rework (tiến độ giảm)
          </span>
        </label>
        </div>
      </div>

      {/* 3. TIMELINE LIST */}
      {loading ? (
        <div className="text-center py-10 text-[hsl(var(--text-muted))]">
          Đang tải dòng thời gian...
        </div>
      ) : groupedLogs.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--text-muted))] border border-dashed border-[hsl(var(--border))] rounded-md">
          <MessageSquare size={36} className="mx-auto mb-3 opacity-40" />
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
                      className="card flex flex-col gap-3.5 bg-[hsl(var(--bg-card))]" 
                      style={{ 
                        padding: '20px', 
                        border: isIncident ? '1.5px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--border))',
                        boxShadow: isIncident ? '0 4px 12px hsl(var(--danger-glow))' : 'var(--shadow-sm)'
                      }}
                    >
                      {/* Log Header */}
                      <div className="flex justify-between items-start flex-wrap gap-3">
                        <div className="flex gap-2.5 items-center">
                          <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[0.85rem] shrink-0 ${isIncident ? 'bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]'}`}>
                            {log.engineerName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-[0.9rem]">{log.engineerName}</strong>
                              <Badge variant="success" className="text-[0.6rem] normal-case py-0.5 px-1.5 h-auto">Kỹ sư hiện trường</Badge>
                            </div>
                            <span className="text-[0.7rem] text-[hsl(var(--text-muted))] flex items-center gap-1 mt-0.5">
                              <Clock size={11} />
                              {log.date.split(' ')[1] || ''}
                            </span>
                          </div>
                        </div>

                        {/* Progress changes */}
                        <div className="text-right">
                          <span className="text-[0.7rem] text-[hsl(var(--text-muted))] font-medium">Thay đổi tiến độ</span>
                          <div className={`font-extrabold text-base flex items-center justify-end gap-1 ${isIncident ? 'text-[hsl(var(--danger))]' : 'text-[hsl(var(--success))]'}`}>
                            <span>{log.progressFrom}%</span>
                            <span>&rarr;</span>
                            <span>{log.progressTo}%</span>
                            <span className="text-xs font-bold">
                              ({delta > 0 ? `+${delta}%` : `${delta}%`})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Task Info Row */}
                      <div className={`bg-[hsl(var(--bg-main))] px-3 py-2 rounded-sm text-sm font-medium flex items-center justify-between border-l-4 ${isIncident ? 'border-[hsl(var(--danger))]' : 'border-[hsl(var(--primary))]'}`}>
                        <span>Công việc: <strong className="text-[hsl(var(--text-primary))]">{log.taskName}</strong></span>
                        {isIncident && <Badge variant="danger" className="text-[0.6rem] py-0.5 h-auto">Báo cáo sự cố</Badge>}
                      </div>

                      {/* Content Text */}
                      <p className="text-[0.9rem] text-[hsl(var(--text-primary))] leading-relaxed whitespace-pre-wrap m-0">
                        {log.content}
                      </p>

                      {/* 3. PROGRESS DELTA VISUAL BAR */}
                      <div className="progress-delta-container">
                        <span className="text-[0.7rem] text-[hsl(var(--text-secondary))] font-semibold">Biểu đồ thay đổi công việc</span>
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
                        <div className={`grid gap-2 mt-1 ${log.images.length === 1 ? 'grid-cols-1' : log.images.length === 2 ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))]'}`}>
                          {log.images.map((img, index) => (
                            <div 
                              key={index} 
                              className={`rounded-md overflow-hidden relative border border-[hsl(var(--border))] cursor-zoom-in group ${log.images?.length === 1 ? 'h-[240px]' : 'h-[120px]'}`}
                              onClick={() => setZoomImage(img)}
                            >
                              <img 
                                src={img} 
                                alt={`Hiện trường ${index + 1}`} 
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white p-1 rounded-full flex items-center justify-center">
                                <Eye size={10} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-1.5 border-t border-[hsl(var(--border)/0.5)] pt-3">
                        <h4 className="text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2 flex items-center gap-1.5">
                          <MessageSquare size={13} />
                          <span>Ý kiến Chỉ đạo & Bình luận ({log.comments?.length || 0})</span>
                        </h4>

                        {(log.comments?.length || 0) > 0 && (
                          <div className="flex flex-col gap-2 mb-3">
                            {log.comments?.map((comm) => {
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
                                  className={`flex gap-2.5 px-3 py-2 bg-[hsl(var(--bg-main)/0.4)] rounded-sm text-[0.825rem] border border-[hsl(var(--border)/0.5)] transition-all duration-200 ${commentClass}`}
                                >
                                  <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold text-[0.75rem] shrink-0 ${isManager ? 'bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))]' : 'bg-[hsl(var(--border))] text-[hsl(var(--text-primary))]'}`}>
                                    {comm.userName.charAt(0)}
                                  </div>
                                  
                                  <div className="flex flex-col gap-0.5 flex-1">
                                    <div className="flex justify-between flex-wrap items-center">
                                      <span>
                                        <strong className="mr-1.5">{comm.userName}</strong>
                                        <Badge variant={getRoleBadgeVariant(comm.role)} className="text-[0.5rem] py-0 px-1 normal-case leading-tight h-auto">
                                          {getRoleLabel(comm.role)}
                                        </Badge>
                                      </span>
                                      <span className="text-[0.65rem] text-[hsl(var(--text-muted))]">{comm.date}</span>
                                    </div>
                                    <p className="text-[hsl(var(--text-primary))] mt-0.5 leading-snug">
                                      {comm.content}
                                    </p>

                                    {isManager && !isAcknowledged && user?.role === 'siteengineer' && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleAcknowledgeComment(comm.id)}
                                        className="self-start py-0.5 px-1.5 text-[0.65rem] mt-1.5 h-auto flex items-center gap-1 border-[hsl(var(--success)/0.4)] text-[hsl(var(--success))]"
                                      >
                                        <CheckCircle size={10} />
                                        <span>Xác nhận đã đọc chỉ đạo</span>
                                      </Button>
                                    )}

                                    {isManager && isAcknowledged && (
                                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-[hsl(var(--success))] font-semibold mt-1">
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
                          <form onSubmit={(e) => handleCommentSubmit(e, log.id)} className="flex gap-2">
                            <Input
                              type="text"
                              placeholder="Nhập ý kiến chỉ đạo trực tuyến của Ban lãnh đạo..."
                              value={commentInputs[log.id] || ''}
                              onChange={(e) => handleCommentChange(log.id, e.target.value)}
                              className="h-9 text-xs flex-1"
                              required
                            />
                            <Button 
                              type="submit" 
                              variant="primary"
                              className="w-9 h-9 p-0 rounded-sm shrink-0 flex items-center justify-center"
                            >
                              <Send size={13} />
                            </Button>
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
        <div className="flex justify-center items-center overflow-hidden">
          {zoomImage && (
            <img 
              src={zoomImage} 
              alt="Zoomed" 
              className="max-w-full max-h-[75vh] object-contain rounded-md"
            />
          )}
        </div>
      </Modal>

    </div>
  );
};
