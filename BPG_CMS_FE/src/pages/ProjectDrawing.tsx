import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';

import type {Project} from '../types/common';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  ArrowLeft,
  FileText,
  UploadCloud,
  Download,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export const ProjectDrawing: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentViewUrl, setCurrentViewUrl] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [showSelectModal, setShowSelectModal] = useState(false);

  const isTPKTOrAdmin = user?.role === 'technicalmanager' || user?.role === 'admin';
  const canEdit = isTPKTOrAdmin && project?.status !== 'done';

  const loadProject = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await projectService.getProjectById(projectId);
      setProject(p);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải thông tin dự án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  useEffect(() => {
    if (project && !currentViewUrl && project.drawingUrl) {
      setCurrentViewUrl(project.drawingUrl);
    }
  }, [project, currentViewUrl]);

  useEffect(() => {
    let active = true;
    if (currentViewUrl && currentViewUrl.toLowerCase().includes('.pdf')) {
      setPdfError('');
      fetch(currentViewUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
          return res.blob();
        })
        .then(blob => {
          if (active) {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            const url = URL.createObjectURL(pdfBlob);
            setBlobUrl(url);
          }
        })
        .catch(err => {
          console.error("Lỗi khi tải PDF blob:", err);
          if (active) setPdfError(`Không thể tải PDF: ${err.message}. Gợi ý: File cũ có thể bị Cloudinary chặn. Hãy xóa đi và upload lại file mới.`);
        });
    } else {
      setBlobUrl('');
      setPdfError('');
    }

    return () => {
      active = false;
    };
  }, [currentViewUrl]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);



  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '12px', color: 'hsl(var(--text-muted))' }}>
        <Loader2 size={24} className="animate-spin" />
        <span>Đang tải thông tin bản vẽ...</span>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--danger))' }}>
        {error}
        <div style={{ marginTop: '16px' }}>
          <button onClick={() => navigate('/projects')} className="btn btn-primary">
            Quay lại danh sách dự án
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h3>Không tìm thấy dự án</h3>
        <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Quay lại danh sách dự án
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px - 48px)', margin: '-24px', backgroundColor: '#070a13' }}>
      {/* Top bar control */}
      <div style={{
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--bg-card))',
        flexWrap: 'wrap', 
        gap: '12px',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius-sm)', background: 'transparent',
              cursor: 'pointer', color: 'hsl(var(--text-secondary))',
              fontSize: '0.85rem', fontWeight: 500,
            }}
          >
            <ArrowLeft size={15} /><span>Quay lại WBS</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Bản vẽ Thiết kế Tổng thể</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'hsl(var(--text-muted))' }}>— {project.name}</span>
            </h2>
            {currentViewUrl ? (
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <FileText size={11} />
                <span>File hiện tại: <strong>{project.attachments?.find(a => a.fileUrl === currentViewUrl)?.fileName || currentViewUrl}</strong></span>
              </p>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '3px 0 0', fontWeight: 500 }}>
                ⚠️ Chưa cập nhật file bản thiết kế tổng thể
              </p>
            )}
          </div>
        </div>

        {/* Action and zoom controls */}
        {currentViewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Zoom tool */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius-sm)', padding: '2px 6px', background: 'hsl(var(--bg-main))' }}>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }}
                title="Thu nhỏ"
              >
                <ZoomOut size={13} />
              </button>
              <span style={{ fontSize: '0.75rem', minWidth: '45px', textAlign: 'center', fontWeight: 600 }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                style={{ padding: '2px 8px', fontSize: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-primary))' }}
                title="Phóng to"
              >
                <ZoomIn size={13} />
              </button>
              {zoomLevel !== 1 && (
                <button 
                  onClick={() => setZoomLevel(1)}
                  style={{ display: 'flex', alignItems: 'center', border: 'none', background: 'transparent', padding: '0 4px', cursor: 'pointer', color: 'hsl(var(--primary))' }}
                  title="Đặt lại tỉ lệ"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>

            {/* Change file (Everyone can select from existing) */}
            {project.drawingUrls && project.drawingUrls.length > 1 && (
              <button
                onClick={() => setShowSelectModal(true)}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 12px' }}
              >
                Chọn bản vẽ khác
              </button>
            )}

            {/* Download button */}
            <button
              onClick={() => {
                alert(`Đang chuẩn bị tải xuống file bản vẽ: ${project.drawingUrl}. (Tính năng giả lập)`);
              }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
            >
              <Download size={14} />
              <span>Tải bản vẽ</span>
            </button>
          </div>
        )}
      </div>

      {/* Alert Strip */}
      {error && (
        <div className="animate-fade-in" style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
          backgroundColor: 'hsl(var(--danger-glow))', borderBottom: '1px solid hsl(var(--danger) / 0.15)',
          color: 'hsl(346 84% 35%)', fontSize: '0.85rem', fontWeight: 500
        }}>
          <AlertTriangle size={16} style={{ color: 'hsl(var(--danger))' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Main viewport canvas */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'auto', 
          backgroundColor: '#070a13', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '40px',
          position: 'relative'
        }}
      >
        {currentViewUrl && (currentViewUrl.startsWith('http') || currentViewUrl.startsWith('blob:') || currentViewUrl.startsWith('data:')) ? (
          /* Large Interactive Blueprint Viewer */
          <div 
            style={{ 
              transform: `scale(${zoomLevel})`, 
              transformOrigin: 'center center', 
              transition: 'transform 0.15s ease-out', 
              width: '100%',
              maxWidth: '1200px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}
          >
            {currentViewUrl.toLowerCase().includes('.pdf') ? (
               pdfError ? (
                 <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--danger))' }}>
                   <AlertTriangle size={48} style={{ margin: '0 auto 16px' }} />
                   <h4>{pdfError}</h4>
                 </div>
               ) : blobUrl ? (
                 <iframe 
                   src={blobUrl}
                   style={{ width: '100%', height: '800px', border: 'none' }} 
                   title="Bản vẽ PDF"
                 />
               ) : (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '800px', gap: '12px', color: 'hsl(var(--text-muted))' }}>
                   <Loader2 size={24} className="animate-spin" />
                   <span>Đang xử lý PDF...</span>
                 </div>
               )
            ) : (
               <img 
                 src={currentViewUrl} 
                 alt="Bản vẽ thiết kế" 
                 style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} 
               />
            )}
          </div>
        ) : currentViewUrl ? (
          /* Invalid URL state */
          <div 
            style={{
              border: '2px dashed hsl(var(--danger) / 0.3)',
              backgroundColor: 'hsl(var(--danger-glow))',
              borderRadius: 'var(--radius-lg)',
              padding: '60px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              width: '100%',
              maxWidth: '600px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <AlertTriangle size={64} style={{ color: 'hsl(var(--danger))' }} />
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: 'hsl(var(--danger))' }}>Lỗi hiển thị bản vẽ</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', maxWidth: '440px', lineHeight: 1.5 }}>
                File bản vẽ không khả dụng (đường dẫn bị lỗi hoặc chưa được đồng bộ lên Cloudinary). Vui lòng cập nhật lại file mới.
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowSelectModal(true)}
                className="btn btn-secondary"
                style={{ fontSize: '0.9rem', fontWeight: 600, padding: '10px 24px', marginTop: '12px' }}
              >
                Chọn bản vẽ khác
              </button>
            )}
          </div>
        ) : (
          /* Empty / Upload state */
          <div 
            style={{
              border: '2px dashed hsl(var(--border-light))',
              backgroundColor: 'hsl(var(--bg-card) / 0.5)',
              borderRadius: 'var(--radius-lg)',
              padding: '60px 40px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              width: '100%',
              maxWidth: '600px',
              boxShadow: 'var(--shadow-lg)',
              minHeight: '340px'
            }}
          >
            <UploadCloud size={64} style={{ color: 'hsl(var(--text-muted))' }} />
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>Chưa có bản vẽ thiết kế</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--text-muted))', maxWidth: '440px', lineHeight: 1.5 }}>
                {canEdit 
                  ? 'Dự án này chưa được tải lên bản thiết kế tổng thể. Hãy vào mục "Sửa thông tin" dự án để tải lên.' 
                  : 'Dự án này chưa được tải lên bản vẽ thiết kế tổng thể. Vui lòng liên hệ Trưởng phòng Kỹ thuật hoặc Leader dự án để cập nhật.'
                }
              </p>
            </div>
            {canEdit && (
              <button
                onClick={() => navigate('/projects')}
                className="btn btn-primary"
                style={{ fontSize: '0.9rem', fontWeight: 600, padding: '10px 24px', marginTop: '12px' }}
              >
                Quay lại danh sách dự án
              </button>
            )}
          </div>
        )}
      </div>

      {/* Select Drawing Modal */}
      <Modal isOpen={showSelectModal} onClose={() => setShowSelectModal(false)} title="Chọn bản vẽ thiết kế" width="md">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600 mb-2">Danh sách các bản vẽ đã được tải lên cho dự án này:</p>
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
            {project.drawingUrls?.map((url, idx) => {
              const attachmentInfo = project.attachments?.find(a => a.fileUrl === url);
              const isSelected = currentViewUrl === url;
              return (
                <div 
                  key={idx} 
                  onClick={() => { setCurrentViewUrl(url); setShowSelectModal(false); }}
                  className={`p-3 border rounded-md cursor-pointer transition-colors flex items-center gap-3 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                >
                  {url.toLowerCase().includes('.pdf') ? (
                    <FileText className={isSelected ? 'text-blue-600' : 'text-gray-400'} size={24} />
                  ) : (
                    <div className="w-10 h-10 rounded border overflow-hidden shrink-0 bg-gray-100 flex items-center justify-center">
                      <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                      {attachmentInfo ? attachmentInfo.fileName : url.split('/').pop()}
                    </p>
                    {attachmentInfo && (
                       <p className="text-xs text-gray-500 mt-1">{((attachmentInfo.fileSizeBytes || 0) / 1024).toFixed(0)} KB</p>
                    )}
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="text-blue-500 shrink-0" size={18} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button className="btn btn-outline" onClick={() => setShowSelectModal(false)}>Đóng</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

