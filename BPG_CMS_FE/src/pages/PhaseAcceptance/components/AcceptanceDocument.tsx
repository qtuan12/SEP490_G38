import React from 'react';
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
  reportContent
}) => {
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

      {/* Render the full saved report content (containing sections 2, 3, 4, 5) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div data-color-mode="light">
          <MDEditor.Markdown
            source={reportContent}
            style={{ padding: 0, fontSize: '14pt', fontFamily: '"Times New Roman", Times, serif', backgroundColor: 'transparent', color: '#000000' }}
          />
        </div>
      </div>

      {/* Signatures block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '40px', pageBreakInside: 'avoid' }}>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN BAN QUẢN LÝ DỰ ÁN</strong>
          <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
            (Ký, ghi rõ họ tên)
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <strong style={{ display: 'block', textTransform: 'uppercase' }}>ĐẠI DIỆN NHÀ THẦU THI CÔNG</strong>
          <span style={{ fontStyle: 'italic', display: 'block', marginTop: '5px' }}>
            (Ký, đóng dấu, ghi rõ họ tên)
          </span>
        </div>
      </div>

      <style>
        {`
          #printable-acceptance-doc p,
          #printable-acceptance-doc li,
          #printable-acceptance-doc tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #printable-acceptance-doc h1,
          #printable-acceptance-doc h2,
          #printable-acceptance-doc h3,
          #printable-acceptance-doc h4,
          #printable-acceptance-doc h5 {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
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
