import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, History, Minus, User } from 'lucide-react';
import { projectService } from '../services/projectService';
import type { TaskProgressLog } from '../types/common';

interface TaskProgressHistoryPanelProps {
  taskId: string;
  taskName?: string;
  /** Số lượng bản ghi hiển thị khi compact. Mặc định hiển thị tất cả */
  limit?: number;
  compact?: boolean;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      return dateStr.replace('T', ' ').slice(0, 16);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return dateStr.replace('T', ' ').slice(0, 16);
  }
};

const ProgressDelta: React.FC<{ oldVal: number; newVal: number }> = ({ oldVal, newVal }) => {
  const delta = newVal - oldVal;
  if (delta > 0) {
    return (
      <span style={{ color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, fontSize: '0.8rem' }}>
        <TrendingUp size={13} />
        +{delta}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span style={{ color: 'hsl(var(--danger))', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, fontSize: '0.8rem' }}>
        <TrendingDown size={13} />
        {delta}%
      </span>
    );
  }
  return (
    <span style={{ color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 700, fontSize: '0.8rem' }}>
      <Minus size={13} />
      0%
    </span>
  );
};

export const TaskProgressHistoryPanel: React.FC<TaskProgressHistoryPanelProps> = ({
  taskId,
  taskName,
  limit,
  compact = false,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'increase' | 'decrease'>('all');

  const { data: logs = [], isLoading, isError } = useQuery<TaskProgressLog[]>({
    queryKey: ['task-progress-history', taskId],
    queryFn: () => projectService.getTaskProgressHistory(taskId),
    enabled: !!taskId,
    staleTime: 30_000,
  });

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      const delta = log.newProgress - log.oldProgress;
      if (filterType === 'increase') return delta > 0;
      if (filterType === 'decrease') return delta < 0;
      return true;
    });
  }, [logs, filterType]);

  const displayedLogs = limit ? filteredLogs.slice(0, limit) : filteredLogs;

  if (isLoading) {
    return (
      <div style={{ padding: compact ? '8px 0' : '16px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>
        Đang tải lịch sử tiến độ...
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: compact ? '8px 0' : '16px', textAlign: 'center', color: 'hsl(var(--danger))', fontSize: '0.8rem' }}>
        Không thể tải lịch sử tiến độ.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '6px' : '10px' }}>
      {/* Header */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid hsl(var(--border))' }}>
          <History size={16} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Lịch sử thay đổi tiến độ{taskName ? `: ${taskName}` : ''}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '999px',
            backgroundColor: 'hsl(var(--primary-glow))',
            color: 'hsl(var(--primary))'
          }}>
            {logs.length} lần cập nhật
          </span>
        </div>
      )}

      {/* Bộ lọc tăng giảm - Chỉ hiện ở chế độ đầy đủ và khi có lịch sử */}
      {!compact && logs.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', fontSize: '0.8rem', padding: '4px 0' }}>
          <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Lọc biến động:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid hsl(var(--border))',
              background: 'white',
              color: 'hsl(var(--text-primary))',
              outline: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.75rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <option value="all">Tất cả thay đổi ({logs.length})</option>
            <option value="increase">Chỉ tăng tiến độ ({logs.filter(l => l.newProgress > l.oldProgress).length})</option>
            <option value="decrease">Chỉ giảm tiến độ ({logs.filter(l => l.newProgress < l.oldProgress).length})</option>
          </select>
        </div>
      )}

      {/* Empty state */}
      {displayedLogs.length === 0 ? (
        <div style={{
          padding: compact ? '8px 0' : '20px',
          textAlign: 'center',
          color: 'hsl(var(--text-muted))',
          fontSize: '0.8rem',
          fontStyle: 'italic'
        }}>
          {logs.length === 0
            ? 'Chưa có lịch sử thay đổi tiến độ.'
            : 'Không có thay đổi tiến độ nào phù hợp với bộ lọc.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '4px' : '8px' }}>
          {displayedLogs.map((log) => {
            const isDecrease = log.newProgress < log.oldProgress;
            const isAutoSync = log.updateReason?.includes('Cập nhật tự động');

            return (
              <div
                key={log.taskProgressLogId}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: compact ? '8px' : '12px',
                  padding: compact ? '7px 10px' : '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isDecrease
                    ? 'hsl(var(--danger-glow))'
                    : isAutoSync
                    ? 'hsl(var(--bg-main) / 0.4)'
                    : 'hsl(var(--success-glow))',
                  border: `1px solid ${isDecrease
                    ? 'hsl(var(--danger) / 0.2)'
                    : isAutoSync
                    ? 'hsl(var(--border))'
                    : 'hsl(var(--success) / 0.2)'}`,
                  fontSize: compact ? '0.75rem' : '0.82rem',
                }}
              >
                {/* Color dot indicator */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDecrease
                    ? 'hsl(var(--danger))'
                    : isAutoSync
                    ? 'hsl(var(--text-muted))'
                    : 'hsl(var(--success))',
                  flexShrink: 0,
                  marginTop: '4px'
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Progress change row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      {log.oldProgress}% → {log.newProgress}%
                    </span>
                    <ProgressDelta oldVal={log.oldProgress} newVal={log.newProgress} />
                    {log.updatedByName && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '1px 7px',
                        borderRadius: '999px',
                        backgroundColor: isAutoSync ? 'hsl(var(--border) / 0.6)' : 'hsl(var(--primary-glow))',
                        color: isAutoSync ? 'hsl(var(--text-muted))' : 'hsl(var(--primary))'
                      }}>
                        {!isAutoSync && <User size={10} />}
                        {log.updatedByName}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', color: 'hsl(var(--text-muted))', fontSize: '0.7rem', flexShrink: 0 }}>
                      {formatDate(log.updatedAt)}
                    </span>
                  </div>

                  {/* Reason */}
                  {log.updateReason && !compact && (
                    <div className="prose prose-sm max-w-none markdown-body" style={{ margin: '3px 0 0', color: 'hsl(var(--text-secondary))', lineHeight: 1.4, wordBreak: 'break-word', fontSize: '0.85rem' }}>
                      <ReactMarkdown>{log.updateReason}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trailing indicator if truncated */}
      {limit && logs.length > limit && (
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
          ... và {logs.length - limit} lần cập nhật trước đó
        </div>
      )}
    </div>
  );
};
