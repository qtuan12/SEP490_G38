import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { projectService } from '../services/projectService';
import type { WBSTask } from '../services/projectService';
import { UploadCloud, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DailyLogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: WBSTask;
  engineerId: string;
  engineerName: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const DailyLogFormModal: React.FC<DailyLogFormModalProps> = ({
  isOpen,
  onClose,
  task,
  engineerId,
  engineerName,
  onSuccess,
  onError
}) => {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'admin' || user?.role === 'tpkt';

  const [progress, setProgress] = useState(task.progress);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Incident fields for progress decrease
  const [incidentCategory, setIncidentCategory] = useState<'khach_quan' | 'chu_quan'>('khach_quan');

  useEffect(() => {
    setProgress(task.progress);
    setContent('');
    setImages([]);
    setIncidentCategory('khach_quan');
  }, [task, isOpen]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImages(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(Array.from(e.target.files));
    }
  };

  const addImages = (files: File[]) => {
    const validFiles = files.filter(f => f.type.startsWith('image/')).slice(0, 5 - images.length);
    if (validFiles.length === 0) return;

    const urls = validFiles.map(file => {
      // For mockup, we can use createObjectURL to show local preview
      return URL.createObjectURL(file);
    });

    setImages(prev => [...prev, ...urls].slice(0, 5));
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      onError('Vui lòng nhập chi tiết diễn biến thi công.');
      return;
    }

    setLoading(true);
    try {
      // Default stock image fallback if no images uploaded
      const finalImages = images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80'
      ];

      await projectService.createDailyLog({
        projectId: task.projectId,
        taskId: task.id,
        taskName: task.name,
        engineerId,
        engineerName,
        progressFrom: task.progress,
        progressTo: progress,
        content,
        weather: '',
        images: finalImages
      }, engineerName, user?.role, incidentCategory);

      onSuccess(`Đã báo cáo nhật ký thi công cho việc "${task.name}" thành công!`);
      onClose();
    } catch (err: any) {
      onError(err.message || 'Lỗi khi gửi nhật ký thi công.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cập nhật Nhật ký công trường">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Lock Info */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          backgroundColor: 'hsl(var(--primary-glow))',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          color: 'hsl(var(--primary-hover))'
        }}>
          <AlertCircle size={16} />
          <span>Báo cáo cho việc: <strong>{task.name}</strong></span>
        </div>

        {/* Progress Slider (Locked from decreasing) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ margin: 0 }}>Tiến độ hoàn thành (%)</label>
            <strong style={{ color: 'hsl(var(--primary))', fontSize: '1.05rem' }}>{progress}%</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              {isPrivileged ? '0%' : `${task.progress}% (Hiện tại)`}
            </span>
            <input
              type="range"
              min={isPrivileged ? 0 : task.progress}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer', height: '6px', accentColor: progress < task.progress ? 'hsl(var(--danger))' : 'hsl(var(--primary))' }}
              disabled={!isPrivileged && task.progress === 100}
            />
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>100%</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '4px' }}>
            {isPrivileged 
              ? '* Quyền TPKT/Admin: Có thể kéo giảm tiến độ để báo cáo sự cố / điều chỉnh.'
              : '* Khóa cứng chiều lùi: Bạn chỉ có thể kéo tiến độ tiến lên hoặc giữ nguyên.'
            }
          </span>
        </div>

        {/* Incident Reporting Block - Only if progress is decreased */}
        {progress < task.progress && (
          <div style={{
            backgroundColor: 'hsl(var(--danger) / 0.1)',
            border: '1px solid hsl(var(--danger) / 0.3)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'hsl(var(--danger))', fontWeight: 600 }}>
              <AlertTriangle size={18} />
              <span>Báo cáo sự cố giảm tiến độ</span>
            </div>
            
            <div>
              <label>Phân loại sự cố</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="incidentCategory" 
                    value="khach_quan" 
                    checked={incidentCategory === 'khach_quan'}
                    onChange={() => setIncidentCategory('khach_quan')}
                  />
                  Sự cố khách quan (Thời tiết, thiên tai...)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="incidentCategory" 
                    value="chu_quan" 
                    checked={incidentCategory === 'chu_quan'}
                    onChange={() => setIncidentCategory('chu_quan')}
                  />
                  Sự cố chủ quan (Lỗi thi công, thiếu vật tư...)
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Work Content Textarea */}
        <div>
          <label htmlFor="log-content">Diễn biến công việc chi tiết <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
          <textarea
            id="log-content"
            placeholder="Mô tả công việc đã làm được hôm nay, số lượng nhân công huy động, các khó khăn gặp phải nếu có..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            required
          />
        </div>

        {/* 5-Image Uploader */}
        <div>
          <label>Hình ảnh hiện trường thi công (Tối đa 5 ảnh)</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: dragging ? '2px dashed hsl(var(--primary))' : '2px dashed hsl(var(--border-light))',
              backgroundColor: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main) / 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onClick={() => document.getElementById('log-image-input')?.click()}
          >
            <input
              id="log-image-input"
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={images.length >= 5}
            />
            <UploadCloud size={28} style={{ color: 'hsl(var(--text-muted))', margin: '0 auto 6px' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', margin: 0 }}>
              Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
            </p>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
              Đã chọn {images.length}/5 ảnh
            </span>
          </div>

          {/* Previews */}
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {images.map((imgUrl, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    position: 'relative', 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: 'var(--radius-sm)', 
                    overflow: 'hidden',
                    border: '1px solid hsl(var(--border))'
                  }}
                >
                  <img src={imgUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            Gửi báo cáo nhật ký
          </button>
        </div>
      </form>
    </Modal>
  );
};
