import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../services/projectService';
import { useAuth } from '../context/AuthContext';
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
  const [success, setSuccess] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const isTPKTOrAdmin = user?.role === 'tpkt' || user?.role === 'admin';
  const canEdit = isTPKTOrAdmin && project?.status !== 'paused' && project?.status !== 'done';

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

  const handleSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
    loadProject();
  };

  const handleError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  };

  const handleUpload = async (file: File) => {
    if (!projectId) return;
    setUploading(true);
    // Simulate network upload
    setTimeout(async () => {
      try {
        await projectService.updateProject(projectId, { drawingUrl: file.name });
        handleSuccess(`Tải lên bản vẽ thành công: ${file.name}`);
      } catch (err: any) {
        handleError(err.message || 'Lỗi khi lưu bản vẽ.');
      } finally {
        setUploading(false);
      }
    }, 800);
  };

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
            {project.drawingUrl ? (
              <p style={{ fontSize: '0.75rem', color: 'hsl(var(--primary))', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                <FileText size={11} />
                <span>File hiện tại: <strong>{project.drawingUrl}</strong></span>
              </p>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '3px 0 0', fontWeight: 500 }}>
                ⚠️ Chưa cập nhật file bản thiết kế tổng thể
              </p>
            )}
          </div>
        </div>

        {/* Action and zoom controls */}
        {project.drawingUrl && (
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

            {/* Change file (TPKT/Admin only) */}
            {canEdit && (
              <>
                <input
                  id="drawing-change-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUpload(e.target.files[0]);
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById('drawing-change-input')?.click()}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  Thay đổi bản vẽ
                </button>
              </>
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
      {success && (
        <div className="animate-fade-in" style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px',
          backgroundColor: 'hsl(var(--success-glow))', borderBottom: '1px solid hsl(var(--success) / 0.15)',
          color: 'hsl(142 70% 30%)', fontSize: '0.85rem', fontWeight: 500
        }}>
          <CheckCircle2 size={16} style={{ color: 'hsl(var(--success))' }} />
          <span>{success}</span>
        </div>
      )}
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
        {project.drawingUrl ? (
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
              overflow: 'hidden'
            }}
          >
            <svg viewBox="0 0 1000 600" style={{ backgroundColor: '#0f172a', width: '100%', height: 'auto', fontFamily: 'monospace', display: 'block' }}>
              {/* CAD blueprint grids */}
              <defs>
                <pattern id="canvas-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <rect width="20" height="20" fill="none" />
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
                <pattern id="canvas-grid-major" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#canvas-grid)" />
                  <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#334155" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="#070a13" />
              <rect width="100%" height="100%" fill="url(#canvas-grid-major)" />

              {/* Exterior framing */}
              <rect x="80" y="60" width="840" height="460" fill="none" stroke="#38bdf8" strokeWidth="3" />
              
              {/* Construction centerlines */}
              <line x1="80" y1="290" x2="920" y2="290" stroke="#0ea5e9" strokeWidth="0.75" strokeDasharray="10,5,2,5" />
              <line x1="500" y1="60" x2="500" y2="520" stroke="#0ea5e9" strokeWidth="0.75" strokeDasharray="10,5,2,5" />

              {/* Grid Partitions */}
              <line x1="280" y1="60" x2="280" y2="520" stroke="#38bdf8" strokeWidth="2" />
              <line x1="720" y1="60" x2="720" y2="520" stroke="#38bdf8" strokeWidth="2" />
              
              <line x1="80" y1="200" x2="280" y2="200" stroke="#38bdf8" strokeWidth="2" />
              <line x1="80" y1="380" x2="280" y2="380" stroke="#38bdf8" strokeWidth="2" />
              
              <line x1="720" y1="230" x2="920" y2="230" stroke="#38bdf8" strokeWidth="2" />
              <line x1="720" y1="350" x2="920" y2="350" stroke="#38bdf8" strokeWidth="2" />

              {/* Inner core walls */}
              <rect x="360" y="160" width="280" height="260" fill="none" stroke="#38bdf8" strokeWidth="2" />
              
              {/* Technical / Elevator core */}
              <rect x="440" y="220" width="120" height="140" fill="none" stroke="#f43f5e" strokeWidth="2" />
              <line x1="440" y1="220" x2="560" y2="360" stroke="#f43f5e" strokeDasharray="4" />
              <line x1="560" y1="220" x2="440" y2="360" stroke="#f43f5e" strokeDasharray="4" />
              
              {/* Columns */}
              {[
                {x: 75, y: 55}, {x: 275, y: 55}, {x: 495, y: 55}, {x: 715, y: 55}, {x: 915, y: 55},
                {x: 75, y: 195}, {x: 275, y: 195}, {x: 715, y: 225}, {x: 915, y: 225},
                {x: 75, y: 285}, {x: 275, y: 285}, {x: 355, y: 285}, {x: 635, y: 285}, {x: 715, y: 285}, {x: 915, y: 285},
                {x: 75, y: 375}, {x: 275, y: 375}, {x: 715, y: 345}, {x: 915, y: 345},
                {x: 75, y: 515}, {x: 275, y: 515}, {x: 495, y: 515}, {x: 715, y: 515}, {x: 915, y: 515}
              ].map((c, i) => (
                <rect key={i} x={c.x} y={c.y} width="10" height="10" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="0.5" />
              ))}

              {/* Labels & Annotations */}
              <text x="180" y="130" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">PHÂN KHU A-1</text>
              <text x="180" y="150" fill="#64748b" fontSize="10" textAnchor="middle">KẾT CẤU BÊ TÔNG MÓNG</text>
              
              <text x="180" y="295" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">HÀNH LANG TRÁI</text>
              
              <text x="180" y="450" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">PHÂN KHU A-2</text>
              <text x="180" y="470" fill="#64748b" fontSize="10" textAnchor="middle">ĐI ĐƯỜNG CÁP NGẦM</text>
              
              <text x="500" y="120" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">SẢNH TRUNG TÂM</text>
              <text x="500" y="210" fill="#f43f5e" fontSize="12" textAnchor="middle" fontWeight="bold">LÕI THANG MÁY & KT</text>
              <text x="500" y="400" fill="#38bdf8" fontSize="14" textAnchor="middle" fontWeight="bold">KÝ TÚC XÁ / ĐIỀU HÀNH</text>

              <text x="820" y="140" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">PHÂN KHU B-1</text>
              <text x="820" y="160" fill="#64748b" fontSize="10" textAnchor="middle">ĐANG THI CÔNG TRỤC C-D</text>
              
              <text x="820" y="295" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">HÀNH LANG PHẢI</text>
              
              <text x="820" y="440" fill="#38bdf8" fontSize="13" textAnchor="middle" fontWeight="bold">PHÂN KHU B-2</text>
              <text x="820" y="460" fill="#64748b" fontSize="10" textAnchor="middle">HOÀN THIỆN ĐIỆN NƯỚC</text>

              {/* Dimensions markers & lines */}
              {/* Outer Horizontal Dim */}
              <path d="M 80 30 L 920 30" stroke="#a7f3d0" strokeWidth="1" />
              <path d="M 80 25 L 80 35" stroke="#a7f3d0" strokeWidth="1" />
              <path d="M 920 25 L 920 35" stroke="#a7f3d0" strokeWidth="1" />
              <text x="500" y="22" fill="#a7f3d0" fontSize="11" textAnchor="middle" fontWeight="bold">CHIỀU DÀI TOÀN BỘ CÔNG TRÌNH: L = 84.00m</text>
              
              {/* Outer Vertical Dim */}
              <path d="M 35 60 L 35 520" stroke="#a7f3d0" strokeWidth="1" />
              <path d="M 30 60 L 40 60" stroke="#a7f3d0" strokeWidth="1" />
              <path d="M 30 520 L 40 520" stroke="#a7f3d0" strokeWidth="1" />
              <text x="22" y="290" fill="#a7f3d0" fontSize="11" textAnchor="middle" fontWeight="bold" transform="rotate(-90 22 290)">CHIỀU RỘNG: W = 46.00m</text>

              {/* Technical Drawing Block */}
              <rect x="620" y="420" width="280" height="85" fill="#070a13" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="620" y1="450" x2="900" y2="450" stroke="#38bdf8" strokeWidth="1" />
              <line x1="620" y1="475" x2="900" y2="475" stroke="#38bdf8" strokeWidth="1" />
              <line x1="780" y1="450" x2="780" y2="505" stroke="#38bdf8" strokeWidth="1" />
              
              <text x="630" y="440" fill="#38bdf8" fontSize="10" fontWeight="bold">DỰ ÁN: {project.name.length > 32 ? project.name.substring(0, 32) + '...' : project.name}</text>
              <text x="630" y="466" fill="#38bdf8" fontSize="8">BẢN VẼ: {project.drawingUrl.length > 28 ? project.drawingUrl.substring(0, 28) + '...' : project.drawingUrl}</text>
              <text x="630" y="492" fill="#38bdf8" fontSize="8">FILE GỐC: {project.drawingUrl}</text>
              
              <text x="790" y="466" fill="#38bdf8" fontSize="8">THIẾT KẾ: BPG-CAD-ARC</text>
              <text x="790" y="492" fill="#a7f3d0" fontSize="9" fontWeight="bold">TL: 1/100 · KHỔ A1</text>
            </svg>
          </div>
        ) : (
          /* Empty / Upload state */
          <div 
            style={{
              border: dragging ? '2px dashed hsl(var(--primary))' : '2px dashed hsl(var(--border-light))',
              backgroundColor: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card) / 0.5)',
              borderRadius: 'var(--radius-lg)',
              padding: '60px 40px',
              textAlign: 'center',
              transition: 'all var(--transition-fast)',
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
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!canEdit) return;
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleUpload(e.dataTransfer.files[0]);
              }
            }}
          >
            {uploading ? (
              <>
                <Loader2 size={48} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--text-secondary))' }}>Đang tải lên bản vẽ kỹ thuật...</strong>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Hệ thống đang lưu trữ và phân tích sơ đồ</span>
              </>
            ) : (
              <>
                <UploadCloud size={64} style={{ color: 'hsl(var(--text-muted))' }} />
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>Chưa có bản vẽ thiết kế</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'hsl(var(--text-muted))', maxWidth: '440px', lineHeight: 1.5 }}>
                    {canEdit 
                      ? 'Dự án này chưa được tải lên bản thiết kế tổng thể. Tải lên file sơ đồ thiết kế kiến trúc (.pdf, .png, .jpg, .jpeg) để bắt đầu phân tích cấu trúc WBS và hiển thị bản vẽ toàn màn hình.' 
                      : 'Dự án này chưa được tải lên bản vẽ thiết kế tổng thể. Vui lòng liên hệ Trưởng phòng Kỹ thuật hoặc Leader dự án để tải bản vẽ lên hệ thống.'
                    }
                  </p>
                </div>

                {canEdit && (
                  <div style={{ marginTop: '12px' }}>
                    <input
                      id="page-drawing-file-input"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('page-drawing-file-input')?.click()}
                      className="btn btn-primary"
                      style={{ fontSize: '0.9rem', fontWeight: 600, padding: '10px 24px' }}
                    >
                      Chọn file bản vẽ để tải lên
                    </button>
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '8px' }}>
                      Hỗ trợ định dạng PDF, PNG, JPG tối đa 20MB. Bạn cũng có thể kéo & thả file vào đây.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
