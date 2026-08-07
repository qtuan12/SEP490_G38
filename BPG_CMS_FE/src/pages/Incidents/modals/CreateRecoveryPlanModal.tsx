import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { Download, FileText, UploadCloud, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { IncidentReport } from '../../../types/common';

export interface CreateRecoveryPlanFormProps {
  incident: IncidentReport;
  onSuccess: (msg: string) => void;
  onCancel: () => void;
}

export const CreateRecoveryPlanForm: React.FC<CreateRecoveryPlanFormProps> = ({
  incident,
  onSuccess,
  onCancel
}) => {
  const queryClient = useQueryClient();
  
  const [maKeHoach, setMaKeHoach] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (incident) {
      setMaKeHoach(`KH-INC-${incident.id}`);
      setSelectedFiles([]);
    }
  }, [incident]);

  const downloadTemplate = () => {
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>Mẫu Kế hoạch khắc phục sự cố</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
          }
          .title {
            text-align: center;
            font-weight: bold;
            font-size: 16pt;
            margin-bottom: 20px;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 15px;
          }
          table, th, td {
            border: 1px solid black;
          }
          th, td {
            padding: 8px;
            text-align: left;
          }
          .signatures {
            width: 100%;
            margin-top: 50px;
          }
          .signatures td {
            border: none;
            text-align: center;
            width: 25%;
            font-size: 11pt;
            vertical-align: top;
          }
        </style>
      </head>
      <body>
        <div class="title">KẾ HOẠCH KHẮC PHỤC SỰ CỐ</div>
        <div style="text-align: center; margin-bottom: 20px; font-style: italic;">
          Mã kế hoạch: KH-INC-${incident.id} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Liên kết báo cáo: INC-${incident.id}
        </div>

        <p><strong>1. Mục tiêu xử lý:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>2. Phạm vi và hạng mục cần khắc phục:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>3. Phương án kỹ thuật:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>4. Nhân sự, vật tư, máy móc:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>5. Tiến độ theo ngày/tuần:</strong></p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; table-layout: fixed;">
          <thead>
            <tr style="background-color: #f2f2f2;">
              <th style="width: 7%; text-align: center; font-weight: bold; border: 1px solid black; padding: 6px;">STT</th>
              <th style="width: 35%; font-weight: bold; border: 1px solid black; padding: 6px;">Nội dung công việc</th>
              <th style="width: 18%; font-weight: bold; border: 1px solid black; padding: 6px;">Người phụ trách</th>
              <th style="width: 14%; text-align: center; font-weight: bold; border: 1px solid black; padding: 6px;">Thời hạn</th>
              <th style="width: 13%; font-weight: bold; border: 1px solid black; padding: 6px;">Kết quả</th>
              <th style="width: 13%; font-weight: bold; border: 1px solid black; padding: 6px;">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; border: 1px solid black; padding: 12px 6px;">1</td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black; padding: 12px 6px;">2</td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
            </tr>
            <tr>
              <td style="text-align: center; border: 1px solid black; padding: 12px 6px;">3</td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
              <td style="border: 1px solid black; padding: 12px 6px;"></td>
            </tr>
          </tbody>
        </table>

        <p><strong>6. Điều kiện nghiệm thu và cho phép thi công lại:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>7. Rủi ro còn lại và biện pháp kiểm soát:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <p><strong>8. Chi phí dự kiến khắc phục:</strong></p>
        <p>..........................................................................................................................................................................................................................................................</p>

        <table class="signatures">
          <tr>
            <td>
              <strong>Người lập</strong><br/>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>${incident.reviewerName || 'Trưởng phòng Kỹ thuật'}</strong>
            </td>
            <td>
              <strong>TP Kỹ thuật</strong><br/>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>${incident.reviewerName || 'Trưởng phòng Kỹ thuật'}</strong>
            </td>
            <td>
              <strong>Ban QLDA</strong><br/>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>.......................................</strong>
            </td>
            <td>
              <strong>Chủ đầu tư</strong><br/>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <div style="height: 60px;"></div>
              <strong>.......................................</strong>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mau_Ke_Hoach_Khac_Phuc_Incident_${incident.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const addFiles = (files: File[]) => {
    const validFiles: File[] = [];
    const allowedExtensions = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'zip', 'rar', 'png', 'jpg', 'jpeg'];
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (allowedExtensions.includes(ext || '')) {
        validFiles.push(file);
      } else {
        toast.error(`Tệp ${file.name} không hỗ trợ (chỉ nhận Word, Excel, PDF, tệp nén, ảnh).`);
      }
    }
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (selectedFiles.length === 0) throw new Error('Vui lòng chọn tệp kế hoạch khắc phục.');
      
      const uploadedUrls = await projectService.uploadFiles(selectedFiles, 'incidents');
      if (!uploadedUrls || uploadedUrls.length !== selectedFiles.length) {
        throw new Error('Lỗi khi tải tệp lên máy chủ.');
      }
      
      const planData = {
        maKeHoach: maKeHoach.trim(),
        lienKetBaoCao: `INC-${incident.id}`,
        files: selectedFiles.map((file, idx) => ({
          fileName: file.name,
          fileUrl: uploadedUrls[idx]
        })),
        isImported: true
      };

      return incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        recoveryPlanText: JSON.stringify(planData),
        recoveryEstimateCost: undefined,
      });
    },
    onSuccess: (result) => {
      console.log(result.message || 'Đã trình hồ sơ lên Giám đốc phê duyệt');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      onSuccess('Trình hồ sơ thành công');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi nộp báo cáo.');
    }
  });

  const handleSubmit = () => {
    if (!maKeHoach.trim()) {
      toast.error('Vui lòng nhập mã kế hoạch.');
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error('Vui lòng tải lên ít nhất một tệp kế hoạch khắc phục.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Banner */}
      <div style={{ padding: '10px 14px', background: 'hsl(var(--primary-glow))', borderRadius: '8px', border: '1px solid hsl(var(--primary)/0.2)' }}>
        <strong style={{ color: 'hsl(var(--primary))', fontSize: '0.85rem', display: 'block' }}>
          LẬP KẾ HOẠCH KHẮC PHỤC QUA TỆP WORD
        </strong>
        <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))' }}>
          Bạn có thể tải tệp mẫu về điều chỉnh trực tiếp trên Word, sau đó tải tệp đã hoàn thành lên đây để trình duyệt.
        </span>
      </div>

      {/* Action: Download Template */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
        <Button
          type="button"
          variant="outline"
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
          style={{ width: '100%', paddingTop: '10px', paddingBottom: '10px', display: 'flex', justifyContent: 'center', fontWeight: 600 }}
        >
          <Download size={16} /> Tải xuống Mẫu Kế hoạch (.doc)
        </Button>
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Drag & Drop File Upload Area */}
        <FormItem label="Các tệp tài liệu kế hoạch khắc phục sự cố (*)" required>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: dragging ? '2px dashed hsl(var(--primary))' : '2px dashed hsl(var(--border))',
              borderRadius: '8px',
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-muted)/0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => document.getElementById('file-upload-recovery')?.click()}
          >
            <input
              type="file"
              id="file-upload-recovery"
              style={{ display: 'none' }}
              accept=".doc,.docx,.pdf,.xls,.xlsx,.zip,.rar,image/*"
              multiple
              onChange={handleFileChange}
            />
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={32} style={{ color: 'hsl(var(--text-muted))' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'hsl(var(--text-primary))' }}>
                Kéo thả hoặc Click để chọn nhiều tệp
              </span>
              <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
                Hỗ trợ: Word, Excel, PDF, tệp nén hoặc ảnh
              </span>
            </div>
          </div>

          {selectedFiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                Danh sách tệp tin đã chọn ({selectedFiles.length}):
              </span>
              {selectedFiles.map((file, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <FileText size={18} style={{ color: '#2b6cb0', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--text-primary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', flexShrink: 0 }}>
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                    }}
                    style={{ color: 'red', display: 'flex', padding: '4px', borderRadius: '4px' }}
                    className="hover:bg-red-50"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormItem>

      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid hsl(var(--border))', paddingTop: '12px' }}>
        <Button variant="outline" onClick={onCancel} disabled={mutation.isPending}>
          Hủy
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Trình kế hoạch lên Giám đốc
        </Button>
      </div>
    </div>
  );
};

interface CreateRecoveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  onSuccess: (msg: string) => void;
}

export const CreateRecoveryPlanModal: React.FC<CreateRecoveryPlanModalProps> = ({
  isOpen,
  onClose,
  incident,
  onSuccess
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Lập Kế hoạch Khắc phục Sự cố" width="md">
      <CreateRecoveryPlanForm
        incident={incident}
        onSuccess={(msg) => {
          onSuccess(msg);
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
};
