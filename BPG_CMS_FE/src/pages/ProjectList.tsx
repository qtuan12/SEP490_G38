import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../services/projectService';
import { Modal } from '../components/Modal';
import { 
  Search, 
  FolderPlus, 
  Layers, 
  MapPin, 
  Calendar, 
  ArrowRight,
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Form Drawer Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    startDate: '',
    endDate: '',
    status: 'draft' as Project['status'],
    drawingName: ''
  });

  const [dragging, setDragging] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách dự án.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.startDate || !formData.endDate) {
      setError('Vui lòng điền đầy đủ các trường thông tin.');
      return;
    }

    try {
      await projectService.createProject({
        name: formData.name,
        address: formData.address,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
        drawingUrl: formData.drawingName || undefined
      });

      setIsOpen(false);
      setFormData({
        name: '',
        address: '',
        startDate: '',
        endDate: '',
        status: 'draft',
        drawingName: ''
      });
      
      setSuccess('Tạo mới dự án thành công!');
      setTimeout(() => setSuccess(null), 3000);
      loadProjects();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra khi tạo dự án.');
    }
  };

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
      const file = e.dataTransfer.files[0];
      setFormData(prev => ({ ...prev, drawingName: file.name }));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFormData(prev => ({ ...prev, drawingName: file.name }));
    }
  };

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: Project['status']) => {
    switch (status) {
      case 'draft': return 'Bản nháp';
      case 'active': return 'Đang chạy';
      case 'paused': return 'Tạm dừng';
      case 'done': return 'Hoàn thành';
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: Project['status']) => {
    switch (status) {
      case 'draft': return 'badge-secondary';
      case 'active': return 'badge-success';
      case 'paused': return 'badge-warning';
      case 'done': return 'badge-primary';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Alert Messages */}
      {success && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--success-glow))',
          border: '1px solid hsl(var(--success) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(142 70% 30%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} style={{ color: 'hsl(var(--success))' }} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'hsl(var(--danger-glow))',
          border: '1px solid hsl(var(--danger) / 0.3)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          color: 'hsl(346 84% 35%)',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <AlertTriangle size={18} style={{ color: 'hsl(var(--danger))' }} />
          <span>{error}</span>
        </div>
      )}

      {/* Control Actions Header */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <Search size={16} style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))'
            }} />
            <input
              type="text"
              placeholder="Tìm kiếm dự án theo tên hoặc địa chỉ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px', height: '40px' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px', height: '40px' }}
          >
            <option value="">Tất cả Trạng thái</option>
            <option value="draft">Bản nháp (Draft)</option>
            <option value="active">Đang hoạt động (Active)</option>
            <option value="paused">Tạm dừng (Paused)</option>
            <option value="done">Hoàn thành (Done)</option>
          </select>
        </div>

        {/* Add Project Button */}
        <button
          onClick={() => {
            setError(null);
            setIsOpen(true);
          }}
          className="btn btn-primary"
          style={{ height: '40px', fontWeight: 600 }}
        >
          <FolderPlus size={18} />
          <span>Khởi tạo Dự án</span>
        </button>
      </div>

      {/* Grid Projects Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', gap: '10px' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'hsl(var(--primary))' }} />
          <span style={{ color: 'hsl(var(--text-secondary))' }}>Đang tải danh sách dự án...</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
          {filteredProjects.length === 0 ? (
            <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'hsl(var(--text-muted))' }}>
              <Layers size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <h3>Không tìm thấy dự án nào trùng khớp</h3>
              <p style={{ fontSize: '0.875rem', marginTop: '6px' }}>Vui lòng điều chỉnh bộ lọc hoặc tạo dự án mới.</p>
            </div>
          ) : (
            filteredProjects.map((p) => (
              <div 
                key={p.id} 
                className="card animate-fade-in" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px', 
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onClick={() => navigate(`/projects/${p.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'hsl(var(--primary))';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'hsl(var(--border))';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
              >
                {/* Upper info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3 }}>{p.name}</h3>
                  <span className={`badge ${getStatusBadgeClass(p.status)}`} style={{ flexShrink: 0 }}>
                    {getStatusLabel(p.status)}
                  </span>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <MapPin size={16} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0, marginTop: '2px' }} />
                    <span>{p.address}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Calendar size={16} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
                    <span>Hạn: {p.startDate} ~ {p.endDate}</span>
                  </div>
                  {p.drawingUrl && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'hsl(var(--primary-hover))' }}>
                      <FileText size={16} />
                      <span style={{ textDecoration: 'underline', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        Bản vẽ: {p.drawingUrl}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>Tiến độ tổng thể:</span>
                    <span style={{ color: 'hsl(var(--primary-hover))' }}>{p.progress}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'hsl(var(--border))', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${p.progress}%`, 
                      height: '100%', 
                      backgroundColor: 'hsl(var(--primary))',
                      background: 'linear-gradient(90deg, hsl(var(--primary-hover)) 0%, hsl(var(--primary)) 100%)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                </div>

                {/* Action button mock */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: 'hsl(var(--primary))', 
                  fontSize: '0.9rem', 
                  fontWeight: 600,
                  marginTop: '4px',
                  borderTop: '1px solid hsl(var(--border) / 0.5)',
                  paddingTop: '12px'
                }}>
                  <span>Xem chi tiết dự án WBS</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Khởi tạo Dự án mới">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="proj-name">Tên dự án <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="proj-name"
              type="text"
              placeholder="Nhập tên dự án công trình"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label htmlFor="proj-address">Địa chỉ công trường <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <input
              id="proj-address"
              type="text"
              placeholder="Số nhà, Tỉnh thành..."
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label htmlFor="proj-start">Ngày dự kiến bắt đầu <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="proj-start"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                required
              />
            </div>
            <div>
              <label htmlFor="proj-end">Ngày dự kiến kết thúc <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
              <input
                id="proj-end"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="proj-status">Trạng thái khởi tạo</label>
            <select
              id="proj-status"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Project['status'] }))}
            >
              <option value="draft">Bản nháp (Draft)</option>
              <option value="active">Đang hoạt động (Active)</option>
            </select>
          </div>

          {/* Dashed Drag and Drop Drawing Box */}
          <div>
            <label>Bản vẽ thiết kế tổng thể</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: dragging ? '2px dashed hsl(var(--primary))' : '2px dashed hsl(var(--border-light))',
                backgroundColor: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-main) / 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onClick={() => document.getElementById('drawing-file-input')?.click()}
            >
              <input
                id="drawing-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <UploadCloud size={36} style={{ color: 'hsl(var(--text-muted))', margin: '0 auto 8px' }} />
              {formData.drawingName ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'hsl(var(--primary))' }}>
                  <FileText size={18} />
                  <strong style={{ fontSize: '0.9rem' }}>{formData.drawingName}</strong>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                    Kéo thả file vào đây hoặc click để duyệt file
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                    Hỗ trợ PDF, PNG, JPG tối đa 20MB
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsOpen(false)}>Hủy bỏ</button>
            <button type="submit" className="btn btn-primary">Xác nhận tạo mới</button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
