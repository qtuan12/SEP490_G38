import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { UploadCloud, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ReportEmergencyStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onSuccess: (msg: string) => void;
}

export const ReportEmergencyStopModal: React.FC<ReportEmergencyStopModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = '',
  onSuccess,
}) => {
  const [description, setDescription] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [estimatedMaterialLoss, setEstimatedMaterialLoss] = useState<number>(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let finalDesc = description.trim();

      if (selectedFiles.length > 0) {
        const uploadedUrls = await projectService.uploadFiles(selectedFiles, 'incidents');
        if (uploadedUrls && uploadedUrls.length > 0) {
          finalDesc += '\n\n**Hình ảnh đính kèm:**\n' + uploadedUrls.map((url, i) => `![Ảnh ${i + 1}](${url})`).join('\n');
        }
      }

      await incidentService.createAndAssessIncident({
        projectId: Number(projectId),
        incidentType: 'Construction',
        description: finalDesc,
        isEmergency: true,
        damageDescription: damageDescription.trim(),
        estimatedMaterialLoss: Number(estimatedMaterialLoss) || 0,
        estimatedLaborDays: 0,
        estimatedDelayDays: 0,
      });
    },
    onSuccess: () => {
      onSuccess('Yêu cầu ngừng thi công khẩn cấp đã được gửi thành công lên TPKT.');
      setDescription('');
      setDamageDescription('');
      setEstimatedMaterialLoss(0);
      setSelectedFiles([]);
      setPreviews([]);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi gửi yêu cầu.');
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

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
    const remaining = 5 - selectedFiles.length;
    if (remaining <= 0) {
      toast.error('Đã đạt giới hạn tối đa 5 ảnh.');
      return;
    }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) {
      toast.error('Hình ảnh không được vượt quá 10MB.');
      return;
    }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;
    setSelectedFiles(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      toast.error('Vui lòng nhập lý do và mô tả sự cố.');
      return;
    }
    if (!damageDescription.trim()) {
      toast.error('Vui lòng nhập khai báo thiệt hại chi tiết.');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛑 Báo cáo Sự cố khẩn cấp & Yêu cầu Dừng dự án" width="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'hsl(0, 100%, 97%)',
          border: '1px solid hsl(0, 80%, 75%)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(0, 92%, 50%)' }}>
            YÊU CẦU NGỪNG THI CÔNG KHẨN CẤP
          </div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
            Dành cho các sự cố đặc biệt nghiêm trọng (thiên tai, lũ lụt, sập đổ) ảnh hưởng đến toàn bộ công trình của dự án <strong>{projectName}</strong>.
          </div>
        </div>

        <FormItem label="Mô tả sự cố & Lý do yêu cầu dừng dự án" required>
          <textarea
            className="input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nêu rõ diễn biến thiên tai/sự cố, mức độ ảnh hưởng diện rộng, đề xuất tạm dừng thi công để đảm bảo an toàn..."
          />
        </FormItem>

        <FormItem label="Khai báo thiệt hại chi tiết" required>
          <textarea
            className="input"
            rows={3}
            value={damageDescription}
            onChange={(e) => setDamageDescription(e.target.value)}
            placeholder="Liệt kê chi tiết các hạng mục, kết cấu, thiết bị bị hư hỏng hoặc cuốn trôi..."
          />
        </FormItem>

        <FormItem label="Ước tính thiệt hại vật tư sơ bộ (VNĐ)">
          <input
            className="input"
            type="number"
            value={estimatedMaterialLoss === 0 ? '' : estimatedMaterialLoss}
            onChange={(e) => setEstimatedMaterialLoss(Number(e.target.value))}
            placeholder="Ví dụ: 50000000 (để trống nếu chưa thể ước tính sơ bộ)"
          />
        </FormItem>

        <FormItem label="Hình ảnh hiện trường sự cố">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('report-emergency-file')?.click()}
          >
            <UploadCloud size={32} style={{ margin: '0 auto 8px', color: 'hsl(var(--text-muted))' }} />
            <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
              Kéo thả hình ảnh vào đây hoặc click để chọn ảnh (Tối đa 5 ảnh)
            </p>
            <input
              type="file"
              id="report-emergency-file"
              style={{ display: 'none' }}
              multiple
              accept="image/*"
              onChange={handleFileSelect}
            />
          </div>

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              {previews.map((src, idx) => (
                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
                  <img src={src} alt="Xem trước" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      borderRadius: '50%',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormItem>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={mutation.isPending}
            disabled={!description.trim() || !damageDescription.trim() || mutation.isPending}
            style={{ background: 'hsl(0, 72%, 45%)' }}
          >
            Gửi yêu cầu dừng dự án khẩn cấp
          </Button>
        </div>
      </div>
    </Modal>
  );
};
