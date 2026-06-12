import React from 'react';
import type {Project, WBSPhase} from '../../../types/common';

import type { AcceptanceData } from '../../../types/common';

interface AcceptanceDocumentProps {
  project: Project;
  phase: WBSPhase;
  data: AcceptanceData;
}

export const AcceptanceDocument: React.FC<AcceptanceDocumentProps> = ({ project, phase, data }) => {
  return (
    <div style={{
      backgroundColor: '#ffffff',
      color: '#1a202c',
      padding: '32px',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid hsl(var(--border))',
      lineHeight: '1.6',
      fontSize: '0.95rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      maxWidth: '100%',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', color: '#1a202c' }}>
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
        </h4>
        <h5 style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem', color: '#2d3748' }}>
          Độc lập – Tự do – Hạnh phúc
        </h5>
        <div style={{ width: '120px', height: '1.5px', backgroundColor: '#2d3748', margin: '8px auto' }} />
      </div>

      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#111827' }}>
          BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
        </h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: '#4b5563' }}>
          Số: BB-NT-{phase.id.toUpperCase()}
        </p>
      </div>

      {/* General project info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px dashed #e5e7eb', paddingBottom: '12px' }}>
        <p style={{ margin: 0 }}><strong>Công trình:</strong> {project.name}</p>
        <p style={{ margin: 0 }}><strong>Địa điểm:</strong> {project.address}</p>
        <p style={{ margin: 0 }}><strong>Hạng mục:</strong> {phase.name}</p>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>1. Đối tượng nghiệm thu:</strong>
          <span style={{ paddingLeft: '16px', display: 'block' }}>{phase.name} (Tất cả công việc con đã hoàn thành 100%)</span>
        </div>

        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>2. Thành phần trực tiếp nghiệm thu:</strong>
          <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ margin: 0 }}><strong>Đại diện Ban quản lý Dự án (Tư vấn giám sát):</strong></p>
            <p style={{ margin: '0 0 0 16px', color: '#374151' }}>Ông/Bà: {data.representativeA} &nbsp;&mdash;&nbsp; Chức vụ: {data.roleA}</p>
            <p style={{ margin: 0 }}><strong>Đại diện Nhà thầu thi công:</strong></p>
            <p style={{ margin: '0 0 0 16px', color: '#374151' }}>Ông/Bà: {data.representativeB} &nbsp;&mdash;&nbsp; Chức vụ: {data.roleB}</p>
          </div>
        </div>

        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>3. Thời gian nghiệm thu:</strong>
          <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <p style={{ margin: 0 }}><strong>Bắt đầu:</strong> {data.startTime ? new Date(data.startTime).toLocaleString('vi-VN') : '...'}</p>
            <p style={{ margin: 0 }}><strong>Kết thúc:</strong> {data.endTime ? new Date(data.endTime).toLocaleString('vi-VN') : '...'}</p>
            <p style={{ margin: 0 }}><strong>Tại công trình:</strong> {project.address}</p>
          </div>
        </div>

        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>4. Đánh giá công việc xây dựng đã thực hiện:</strong>
          <div style={{ paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <p style={{ margin: 0 }}><strong>a) Căn cứ nghiệm thu:</strong></p>
            <ul style={{ margin: '2px 0 0 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '2px', color: '#374151' }}>
              <li>Phiếu yêu cầu nghiệm thu của nhà thầu thi công xây dựng.</li>
              <li>Hồ sơ thiết kế bản vẽ thi công và những thay đổi thiết kế được duyệt: <strong>Bản vẽ số {data.drawings}</strong>.</li>
              <li>Tiêu chuẩn, qui phạm xây dựng áp dụng: <strong>{data.standards}</strong>.</li>
              <li>Kết quả kiểm tra thí nghiệm chất lượng vật liệu, thiết bị: <strong>{data.results}</strong>.</li>
              <li>Nhật ký thi công, giám sát và các văn bản liên quan.</li>
            </ul>
            <p style={{ margin: '4px 0 0 0' }}><strong>b) Về chất lượng công việc:</strong> {data.quality}</p>
            {data.opinions && <p style={{ margin: 0 }}><strong>c) Ý kiến khác:</strong> {data.opinions}</p>}
          </div>
        </div>

        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', color: '#111827', marginBottom: '2px' }}>5. Kết luận:</strong>
          <div style={{ 
            padding: '8px 16px', 
            backgroundColor: '#f0fdf4', 
            borderLeft: '4px solid #16a34a', 
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            color: '#15803d'
          }}>
            {data.conclusion}
          </div>
        </div>
      </div>

      {/* Signatures block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '24px', borderTop: '1px dashed #d1d5db', paddingTop: '16px', gap: '16px' }}>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ fontSize: '0.85rem', display: 'block', textTransform: 'uppercase', color: '#374151' }}>CÁN BỘ GIÁM SÁT THI CÔNG</strong>
          <span style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', color: 'hsl(var(--success))', marginTop: '4px', fontWeight: 600 }}>
            [Đã ký số điện tử]
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '1px' }}>Ngày ký: {data.acceptanceDate}</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block', marginTop: '20px', color: '#111827' }}>{data.representativeA}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ fontSize: '0.85rem', display: 'block', textTransform: 'uppercase', color: '#374151' }}>KỸ THUẬT THI CÔNG TRỰC TIẾP</strong>
          <span style={{ fontSize: '0.75rem', fontStyle: 'italic', display: 'block', color: 'hsl(var(--success))', marginTop: '4px', fontWeight: 600 }}>
            [Đã ký số điện tử]
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '1px' }}>Ngày ký: {data.acceptanceDate}</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, display: 'block', marginTop: '20px', color: '#111827' }}>{data.representativeB}</span>
        </div>
      </div>
    </div>
  );
};
