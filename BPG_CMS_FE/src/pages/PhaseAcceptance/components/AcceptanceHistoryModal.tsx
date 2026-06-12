import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import type {AcceptanceRecord} from '../../../types/common';

interface AcceptanceHistoryModalProps {
  selectedHistory: AcceptanceRecord | null;
  onClose: () => void;
}

export const AcceptanceHistoryModal: React.FC<AcceptanceHistoryModalProps> = ({ selectedHistory, onClose }) => {
  if (!selectedHistory) return null;

  return (
    <Modal 
      isOpen={!!selectedHistory} 
      onClose={onClose} 
      title={`Chi tiết Biên bản Nghiệm thu - ${selectedHistory.date}`}
    >
      <div style={{
        backgroundColor: '#ffffff',
        color: '#1a202c',
        padding: '24px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid hsl(var(--border))',
        lineHeight: '1.5',
        fontSize: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxHeight: '75vh',
        overflowY: 'auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
          <h5 style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.85rem' }}>Độc lập – Tự do – Hạnh phúc</h5>
        </div>
        
        <div style={{ textAlign: 'center', margin: '10px 0' }}>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.15rem' }}>BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG</h2>
          <span className={`badge ${selectedHistory.isPassed ? 'badge-success' : 'badge-danger'}`} style={{ marginTop: '8px' }}>
            {selectedHistory.isPassed ? 'KẾT QUẢ ĐẠT' : 'KẾT QUẢ KHÔNG ĐẠT'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div><strong>Thành phần nghiệm thu:</strong></div>
          <div>- Bên A: {selectedHistory.representativeA} ({selectedHistory.roleA})</div>
          <div>- Bên B: {selectedHistory.representativeB} ({selectedHistory.roleB})</div>
        </div>

        <div>
          <strong>Thời gian:</strong> Từ {new Date(selectedHistory.startTime).toLocaleString('vi-VN')} đến {new Date(selectedHistory.endTime).toLocaleString('vi-VN')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <strong>Đánh giá chất lượng:</strong>
          <p style={{ margin: 0, paddingLeft: '8px', borderLeft: '3px solid #e2e8f0' }}>{selectedHistory.quality}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <strong>Kết luận của TPKT:</strong>
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: selectedHistory.isPassed ? '#f0fdf4' : '#fef2f2', 
            borderLeft: `4px solid ${selectedHistory.isPassed ? '#16a34a' : '#dc2626'}`, 
            fontWeight: 600,
            color: selectedHistory.isPassed ? '#15803d' : '#b91c1c'
          }}>
            {selectedHistory.conclusion}
          </div>
        </div>
      </div>
    </Modal>
  );
};
