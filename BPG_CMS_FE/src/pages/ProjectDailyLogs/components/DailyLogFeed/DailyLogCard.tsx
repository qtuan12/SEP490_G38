import React, { useState, useRef, useEffect } from 'react';
import { Clock, Send, MessageSquare, Eye, Edit2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Badge, Button, ConfirmDialog } from '../../../../components/ui';
import { projectService } from '../../../../services/projectService';
import type { DailyLog, WBSTask } from '../../../../types/common';
import { getRoleLabel, getRoleBadgeVariant } from '../../../../utils/roleHelpers';

interface DailyLogCardProps {
  log: DailyLog;
  user: any;
  members: any[];
  tasks: WBSTask[];
  canManageExecution: boolean;
  onEditLog: (log: DailyLog) => void;
  onZoomImage: (img: string) => void;
  onReloadLogs: () => Promise<void>;
}

import { formatDateVietnam } from '../../../../utils/dateHelpers';

const formatCommentDate = (dateStr: string): string => formatDateVietnam(dateStr);

export const DailyLogCard: React.FC<DailyLogCardProps> = ({
  log,
  user,
  members,
  tasks,
  canManageExecution,
  onEditLog,
  onZoomImage,
  onReloadLogs
}) => {
  const [commentInput, setCommentInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingComment, setIsUpdatingComment] = useState(false);

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const editCommentRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic vertical auto-scaling for main comment input
  useEffect(() => {
    if (commentInputRef.current) {
      commentInputRef.current.style.height = '42px';
      commentInputRef.current.style.height = `${Math.min(commentInputRef.current.scrollHeight, 160)}px`;
    }
  }, [commentInput]);

  // Dynamic vertical auto-scaling for edit comment input
  useEffect(() => {
    if (editCommentRef.current) {
      editCommentRef.current.style.height = '38px';
      editCommentRef.current.style.height = `${Math.min(editCommentRef.current.scrollHeight, 140)}px`;
    }
  }, [editingCommentContent, editingCommentId]);

  const isIncident = log.progressTo < log.progressFrom;
  const delta = log.progressTo - log.progressFrom;

  const searchParams = new URLSearchParams(window.location.search);
  const highlightedLogId = searchParams.get('logId');
  const isHighlighted = highlightedLogId === log.id.toString();

  // Scroll into view if this card is highlighted
  useEffect(() => {
    if (isHighlighted) {
      const element = document.getElementById(`daily-log-${log.id}`);
      if (element) {
        const timeout = setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 400);
        return () => clearTimeout(timeout);
      }
    }
  }, [isHighlighted, log.id]);

  // Determine node border/glow style
  let cardStyle: React.CSSProperties = {
    padding: '20px',
    border: isHighlighted
      ? '2px solid hsl(var(--primary))'
      : (isIncident ? '1.5px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--border))'),
    boxShadow: isHighlighted
      ? '0 0 20px hsl(var(--primary) / 0.35)'
      : (isIncident ? '0 4px 12px hsl(var(--danger-glow))' : 'var(--shadow-sm)'),
    transition: 'all 0.4s ease-in-out'
  };

  // Determine timeline indicator color class
  let nodeClass = "timeline-node-info";
  if (isIncident) {
    nodeClass = "timeline-node-danger";
  } else if (delta > 0) {
    nodeClass = "timeline-node-success";
  }

  // Permissions to edit the main daily log
  const logTask = tasks.find(t => String(t.id).replace(/^t-/, '') === String(log.taskId).replace(/^t-/, ''));
  const assignedIds = logTask?.assignedTo ? logTask.assignedTo.split(',').map(s => s.trim()) : [];
  const isAssigned = user?.id && assignedIds.includes(user.id.toString());
  const canEditLog = canManageExecution || isAssigned;

  // Comment Actions
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmittingComment) return;

    const content = commentInput.trim();
    if (!content) return;

    setIsSubmittingComment(true);
    try {
      await projectService.addLogComment(log.id, {
        id: user.id,
        name: user.name,
        role: user.role
      }, content);

      setCommentInput('');
      await onReloadLogs();
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi bình luận.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentUpdateSubmit = async (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (isUpdatingComment) return;

    const content = editingCommentContent.trim();
    if (!content) return;

    setIsUpdatingComment(true);
    try {
      await projectService.updateLogComment(commentId, content);
      setEditingCommentId(null);
      await onReloadLogs();
    } catch (err: any) {
      toast.error(err.message || 'Không thể cập nhật bình luận.');
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const handleCommentDeleteConfirm = async () => {
    if (!deleteCommentId) return;
    setIsDeletingComment(true);
    try {
      const success = await projectService.deleteLogComment(deleteCommentId);
      if (success) {
        toast.success('Đã xóa bình luận.');
        await onReloadLogs();
      }
      setDeleteCommentId(null);
    } catch (err: any) {
      toast.error(err.message || 'Không thể xóa bình luận.');
    } finally {
      setIsDeletingComment(false);
    }
  };

  return (
    <div id={`daily-log-${log.id}`} className="timeline-item animate-fade-in text-left">
      {/* Circle Node on Timeline Track */}
      <div className={`timeline-node ${nodeClass}`} />

      {/* Main Log Card */}
      <div className="card flex flex-col gap-3.5 bg-[hsl(var(--bg-card))] min-w-0 w-full overflow-hidden" style={cardStyle}>
        {/* Log Header */}
        <div className="flex justify-between items-start flex-wrap gap-3 min-w-0">
          <div className="flex gap-2.5 items-center min-w-0">
            <div className={`w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-[0.85rem] shrink-0 ${isIncident ? 'bg-[hsl(var(--danger-glow))] text-[hsl(var(--danger))]' : 'bg-[hsl(var(--primary-glow))] text-[hsl(var(--primary))]'}`}>
              {log.engineerName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <strong className="text-[0.9rem] truncate">{log.engineerName}</strong>
                {(() => {
                  const mInfo = members.find(m => String(m.userId) === String(log.engineerId));
                  let cRole = mInfo ? mInfo.role : '';
                  if (!cRole) {
                    if (String(user?.id) === String(log.engineerId)) {
                      cRole = user?.role || '';
                    } else {
                      if (log.engineerName.toLowerCase().includes('tuan') || log.engineerName.toLowerCase().includes('tpkt')) {
                        cRole = 'technicalmanager';
                      } else if (log.engineerName.toLowerCase().includes('admin')) {
                        cRole = 'admin';
                      } else {
                        cRole = 'siteengineer';
                      }
                    }
                  }
                  return (
                    <Badge variant={getRoleBadgeVariant(cRole)} className="text-[0.6rem] normal-case py-0.5 px-1.5 h-auto shrink-0">
                      {getRoleLabel(cRole)}
                    </Badge>
                  );
                })()}
                {(canEditLog && log.canEdit !== false) && (
                  <button
                    onClick={() => onEditLog(log)}
                    className="text-slate-400 hover:text-blue-600 transition-colors p-1 shrink-0"
                    title="Sửa nhật ký"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
              <span className="text-[0.7rem] text-[hsl(var(--text-muted))] flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Clock size={11} />
                <span>{log.date.includes(' ') ? log.date.split(' ')[1] : ''}</span>
                {log.isEdited && (
                  <span
                    className="inline-flex items-center gap-0.5 text-amber-600 font-medium cursor-help"
                    title={log.lastEditedAt ? `Đã chỉnh sửa lúc: ${formatCommentDate(log.lastEditedAt)}` : 'Đã chỉnh sửa'}
                  >
                    <span>•</span>
                    <Edit2 size={9} className="shrink-0" />
                    <span>Đã chỉnh sửa</span>
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Progress changes */}
          <div className="text-right shrink-0">
            <span className="text-[0.7rem] text-[hsl(var(--text-muted))] font-medium">Tiến độ được báo cáo tại thời điểm này</span>
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
        <div className={`bg-[hsl(var(--bg-main))] px-3 py-2 rounded-sm text-sm font-medium flex items-center justify-between border-l-4 min-w-0 flex-wrap gap-2 ${isIncident ? 'border-[hsl(var(--danger))]' : 'border-[hsl(var(--primary))]'}`}>
          <span className="min-w-0 break-words">Công việc: <strong className="text-[hsl(var(--text-primary))] break-words">{log.taskName}</strong></span>
        </div>

        {/* Content Text */}
        <p className="text-[0.9rem] text-[hsl(var(--text-primary))] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 min-w-0">
          {log.content}
        </p>

        {/* Images Grid */}
        {log.images && log.images.length > 0 && (
          <div className={`grid gap-2 mt-1 ${log.images.length === 1 ? 'grid-cols-1' : log.images.length === 2 ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))]'}`}>
            {log.images.map((img, index) => (
              <div
                key={index}
                className={`rounded-md overflow-hidden relative border border-[hsl(var(--border))] cursor-zoom-in group ${log.images?.length === 1 ? 'h-[240px]' : 'h-[120px]'}`}
                onClick={() => onZoomImage(img)}
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

        {/* Comments & Instructions Thread */}
        <div className="mt-1.5 border-t border-[hsl(var(--border)/0.5)] pt-3 min-w-0 w-full overflow-hidden">
          <h4 className="text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2 flex items-center gap-1.5">
            <MessageSquare size={13} />
            <span>Ý kiến Chỉ đạo & Bình luận ({log.comments?.length || 0})</span>
          </h4>

          {/* Comments List */}
          {(log.comments?.length || 0) > 0 && (
            <div className="flex flex-col gap-2 mb-3 min-w-0 w-full">
              {log.comments?.map((comm) => {
                const isManager = comm.role === 'technicalmanager' || comm.role === 'director';
                let commentClass = isManager ? "comment-highlight-manager" : "";
                const userRole = (user?.role || '').toLowerCase();
                const canEditComment = String(comm.userId) === String(user?.id) || userRole === 'admin' || userRole === 'technicalmanager';

                return (
                  <div
                    key={comm.id}
                    className={`flex gap-2.5 px-3 py-2 bg-[hsl(var(--bg-main)/0.4)] rounded-sm text-[0.825rem] border border-[hsl(var(--border)/0.5)] transition-all duration-200 min-w-0 w-full overflow-hidden ${commentClass}`}
                  >
                    <div className={`w-[26px] h-[26px] rounded-full flex items-center justify-center font-bold text-[0.75rem] shrink-0 ${isManager ? 'bg-[hsl(var(--warning-glow))] text-[hsl(var(--warning))]' : 'bg-[hsl(var(--border))] text-[hsl(var(--text-primary))]'}`}>
                      {comm.userName.charAt(0)}
                    </div>

                    <div className="flex flex-col gap-0.5 flex-1 min-w-0 w-full overflow-hidden">
                      <div className="flex justify-between flex-wrap items-center gap-1 min-w-0">
                        <span className="min-w-0">
                          <strong className="mr-1.5">{comm.userName}</strong>
                          <Badge variant={getRoleBadgeVariant(comm.role)} className="text-[0.5rem] py-0 px-1 normal-case leading-tight h-auto shrink-0">
                            {getRoleLabel(comm.role)}
                          </Badge>
                        </span>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[0.65rem] text-[hsl(var(--text-muted))]">{formatCommentDate(comm.date)}</span>
                          {canEditComment && editingCommentId !== comm.id && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingCommentId(comm.id);
                                  setEditingCommentContent(comm.content);
                                }}
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                                title="Sửa bình luận"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={() => setDeleteCommentId(comm.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Xóa bình luận"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {editingCommentId === comm.id ? (
                        <form
                          onSubmit={(e) => handleCommentUpdateSubmit(e, comm.id)}
                          className="flex flex-col gap-2 mt-1.5 w-full min-w-0"
                        >
                          <textarea
                            ref={editCommentRef}
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (editingCommentContent.trim() && !isUpdatingComment) {
                                  handleCommentUpdateSubmit(e, comm.id);
                                }
                              }
                            }}
                            disabled={isUpdatingComment}
                            rows={1}
                            className="w-full text-xs p-2.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--bg-main))] text-[hsl(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none overflow-y-auto leading-relaxed min-h-[38px] max-h-[140px]"
                            required
                            autoFocus
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-[hsl(var(--text-muted))]">
                              * <strong>Enter</strong> để lưu, <strong>Shift + Enter</strong> xuống dòng
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button size="sm" type="button" variant="outline" disabled={isUpdatingComment} className="h-7 px-2 text-xs" onClick={() => setEditingCommentId(null)}>Hủy</Button>
                              <Button size="sm" type="submit" variant="primary" isLoading={isUpdatingComment} disabled={isUpdatingComment || !editingCommentContent.trim()} className="h-7 px-2 text-xs">Lưu</Button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <p className="text-[hsl(var(--text-primary))] mt-0.5 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0 m-0">
                          {comm.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment Form */}
          {user && (members.some(m => m.userId === user?.id) || canManageExecution) && (
            <form onSubmit={handleCommentSubmit} className="flex gap-2 items-start w-full min-w-0">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <textarea
                  ref={commentInputRef}
                  placeholder="Nhập ý kiến chỉ đạo trực tuyến hoặc bình luận..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (commentInput.trim() && !isSubmittingComment) {
                        handleCommentSubmit(e);
                      }
                    }
                  }}
                  disabled={isSubmittingComment}
                  rows={1}
                  className="w-full text-xs p-2.5 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--bg-main))] text-[hsl(var(--text-primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none overflow-y-auto leading-relaxed min-h-[42px] max-h-[160px] transition-all"
                  required
                />
                <span className="text-[10px] text-[hsl(var(--text-muted))]">
                  * Bấm <strong>Enter</strong> để gửi, <strong>Shift + Enter</strong> để xuống dòng.
                </span>
              </div>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmittingComment}
                disabled={isSubmittingComment || !commentInput.trim()}
                className="h-[42px] min-w-[46px] px-3.5 rounded-md shrink-0 flex items-center justify-center"
                title="Gửi bình luận"
              >
                <Send size={19} strokeWidth={2.5} />
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Delete Comment Modal (Isolated locally on card) */}
      <ConfirmDialog
        isOpen={!!deleteCommentId}
        onClose={() => setDeleteCommentId(null)}
        onConfirm={handleCommentDeleteConfirm}
        title="Xóa bình luận"
        message="Bạn có chắc chắn muốn xóa bình luận này không? Thao tác này không thể hoàn tác."
        confirmText="Xác nhận xóa"
        isDanger={true}
        isLoading={isDeletingComment}
      />
    </div>
  );
};
