import React, { useState } from 'react';
import type { Project, WBSPhase } from '../../../types/common';
import MDEditor from '@uiw/react-md-editor';

interface AcceptanceDocumentProps {
  project: Project;
  phase: WBSPhase;
  reportContent: string;
  acceptanceDate?: string;
  creatorName?: string;
}

export const AcceptanceDocument: React.FC<AcceptanceDocumentProps> = ({
  project,
  phase,
  reportContent,
  acceptanceDate = new Date().toISOString(),
  creatorName = 'Người lập báo cáo'
}) => {
  const [repAName, setRepAName] = useState('');
  const [repARole, setRepARole] = useState('');
  const [repBName, setRepBName] = useState('');
  const [repBRole, setRepBRole] = useState('');
  const [endTime, setEndTime] = useState('');
  const [conclusion1, setConclusion1] = useState('');
  const [conclusion2, setConclusion2] = useState('');
  return (
    <div
      id="printable-acceptance-doc"
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '40px 50px',
        lineHeight: '1.5',
        fontSize: '14pt',
        fontFamily: '"Times New Roman", Times, serif',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '14pt', textTransform: 'uppercase' }}>
          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
        </h4>
        <h5 style={{ margin: '5px 0 0 0', fontWeight: 'bold', fontSize: '14pt' }}>
          Độc lập – Tự do – Hạnh phúc
        </h5>
        <div style={{ width: '150px', height: '1.5px', backgroundColor: '#000000', margin: '10px auto' }} />
      </div>

      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <h2 style={{ margin: 0, fontWeight: 'bold', fontSize: '16pt', textTransform: 'uppercase' }}>
          BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
        </h2>
        <p style={{ margin: '5px 0 0 0', fontStyle: 'italic' }}>
          Số: BB-NT-{phase.id.toUpperCase()}
        </p>
      </div>

      {/* General project info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <p style={{ margin: 0 }}><strong>1. Công trình:</strong> {project.name}</p>
        <p style={{ margin: 0 }}><strong>- Hạng mục:</strong> {phase.name}</p>
        <p style={{ margin: 0 }}><strong>- Địa điểm xây dựng:</strong> {project.address}</p>
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div>
          <p style={{ margin: '0 0 5px 0' }}><strong>2. Thành phần trực tiếp nghiệm thu:</strong></p>
          <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <p style={{ margin: 0 }}><strong>● Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát):</strong></p>
            <p style={{ margin: '0 0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>- Ông/Bà:</span>
              <input
                type="text"
                value={repAName}
                onChange={(e) => setRepAName(e.target.value)}
                placeholder=""
                style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1.5, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
              />
              <span>Chức vụ:</span>
              <input
                type="text"
                value={repARole}
                onChange={(e) => setRepARole(e.target.value)}
                placeholder=""
                style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
              />
            </p>
            <p style={{ margin: '10px 0 0 0' }}><strong>● Đại diện Nhà thầu thi công:</strong></p>
            <p style={{ margin: '0 0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>- Ông/Bà:</span>
              <input
                type="text"
                value={repBName}
                onChange={(e) => setRepBName(e.target.value)}
                placeholder=""
                style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1.5, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
              />
              <span>Chức vụ:</span>
              <input
                type="text"
                value={repBRole}
                onChange={(e) => setRepBRole(e.target.value)}
                placeholder=""
                style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
              />
            </p>
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 5px 0' }}><strong>3. Thời gian nghiệm thu:</strong></p>
          <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <p style={{ margin: 0 }}>Bắt đầu: {acceptanceDate}</p>
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Kết thúc:</span>
              <input
                type="text"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder=""
                style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', flex: 1, maxWidth: '400px', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
              />
            </p>
            <p style={{ margin: 0 }}>Tại công trình: {project.address}</p>
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 10px 0' }}><strong>4. Đánh giá công việc xây dựng đã thực hiện:</strong></p>
          <div data-color-mode="light" style={{ paddingLeft: '20px' }}>
            <MDEditor.Markdown
              source={reportContent}
              style={{ padding: 0, fontSize: '14pt', fontFamily: '"Times New Roman", Times, serif', backgroundColor: 'transparent', color: '#000000' }}
            />
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 10px 0' }}><strong>5. Kết luận:</strong></p>
          <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              value={conclusion1}
              onChange={(e) => setConclusion1(e.target.value)}
              placeholder=""
              style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', width: '100%', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
            />
            <input
              type="text"
              value={conclusion2}
              onChange={(e) => setConclusion2(e.target.value)}
              placeholder=""
              style={{ border: 'none', borderBottom: '1.5px dotted #000', outline: 'none', width: '100%', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
            />
          </div>
        </div>
      </div>

      {/* Signatures block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '40px', pageBreakInside: 'avoid' }}>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN BAN QUẢN LÝ DỰ ÁN</strong>
          <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
            (Ký, ghi rõ họ tên)
          </span>
          <br /><br /><br /><br />
          <strong style={{ display: 'block' }}>{creatorName}</strong>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN NHÀ THẦU THI CÔNG</strong>
          <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
            (Ký, đóng dấu, ghi rõ họ tên)
          </span>
          <br /><br /><br />
          <input
            type="text"
            value={repBName}
            onChange={(e) => setRepBName(e.target.value)}
            placeholder=""
            style={{ border: 'none', outline: 'none', textAlign: 'center', width: '80%', fontWeight: 'bold', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt', padding: '0 4px', backgroundColor: 'transparent', color: '#000000' }}
          />
        </div>
      </div>

      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-acceptance-doc, #printable-acceptance-doc * {
              visibility: visible;
            }
            #printable-acceptance-doc {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
            }
          }
        `}
      </style>
    </div>
  );
};
