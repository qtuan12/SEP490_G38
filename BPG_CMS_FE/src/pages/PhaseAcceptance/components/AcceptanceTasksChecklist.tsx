import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type {WBSTask} from '../../../types/common';

interface AcceptanceTasksChecklistProps {
  tasks: WBSTask[];
  allCompleted: boolean;
}

export const AcceptanceTasksChecklist: React.FC<AcceptanceTasksChecklistProps> = ({ tasks, allCompleted }) => {
  return (
    <div className="card">
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
        Kiểm soát Tiến độ các Hạng mục trong Giai đoạn
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((t) => (
          <div 
            key={t.id} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '12px 16px',
              backgroundColor: 'hsl(var(--bg-main) / 0.4)',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={18} style={{ color: t.progress === 100 ? 'hsl(var(--success))' : 'hsl(var(--text-muted))' }} />
              <span style={{ fontWeight: 500 }}>{t.name}</span>
            </div>
            <span className={`badge ${t.progress === 100 ? 'badge-success' : 'badge-danger'}`}>
              {t.progress}% Hoàn thành
            </span>
          </div>
        ))}

        {tasks.length === 0 && (
          <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
            Không tìm thấy công việc nào để soát trong giai đoạn này.
          </p>
        )}
      </div>

      {/* Readiness Warnings */}
      {!allCompleted && (
        <div style={{
          marginTop: '16px',
          display: 'flex',
          gap: '10px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.2)',
          padding: '14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          color: 'hsl(346 84% 35%)',
          alignItems: 'center'
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>Chưa đủ điều kiện nghiệm thu:</strong> Tất cả công việc con phải đạt 100% tiến độ trước khi tiến hành nghiệm thu và đóng băng giai đoạn.
          </span>
        </div>
      )}
    </div>
  );
};
