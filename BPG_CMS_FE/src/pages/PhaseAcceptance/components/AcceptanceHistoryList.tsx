import React from 'react';
import { Clock } from 'lucide-react';
import type {AcceptanceRecord} from '../../../types/common';

interface AcceptanceHistoryListProps {
  history?: AcceptanceRecord[];
  onSelect: (record: AcceptanceRecord) => void;
}

export const AcceptanceHistoryList: React.FC<AcceptanceHistoryListProps> = ({ history, onSelect }) => {
  return (
    <div className="card">
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '8px' }}>
        Lịch sử Nghiệm thu Giai đoạn
      </h3>
      {history && history.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.map((record) => (
            <div 
              key={record.id}
              onClick={() => onSelect(record)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px',
                backgroundColor: 'hsl(var(--bg-main) / 0.4)',
                border: `1px solid ${record.isPassed ? 'hsl(var(--success) / 0.5)' : 'hsl(var(--danger) / 0.5)'}`,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--bg-muted))'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main) / 0.4)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} style={{ color: 'hsl(var(--text-muted))' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nghiệm thu lúc {record.date}</span>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Người đại diện: {record.representativeB} (Bên B)</span>
                </div>
              </div>
              <span className={`badge ${record.isPassed ? 'badge-success' : 'badge-danger'}`}>
                {record.isPassed ? 'ĐẠT (ĐÓNG BĂNG)' : 'KHÔNG ĐẠT'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '20px 0' }}>
          Chưa có biên bản nghiệm thu nào được ghi nhận.
        </p>
      )}
    </div>
  );
};
