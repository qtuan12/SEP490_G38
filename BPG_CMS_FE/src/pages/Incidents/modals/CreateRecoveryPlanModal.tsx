import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { UploadCloud, X, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { IncidentReport } from '../../../types/common';

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
  const queryClient = useQueryClient();
  const [cost, setCost] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCost(0);
      setSelectedFile(null);
      setDragging(false);
    }
  }, [isOpen]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error('Vui lòng chọn hoặc tải lên tệp kế hoạch khắc phục Word.');
      }

      // Upload file to server
      const uploadedUrls = await projectService.uploadFiles([selectedFile], 'incidents');
      const fileUrl = uploadedUrls && uploadedUrls.length > 0 ? uploadedUrls[0] : '';
      
      if (!fileUrl) {
        throw new Error('Lỗi khi tải tệp kế hoạch lên hệ thống.');
      }

      const docData = {
        fileUrl,
        fileName: selectedFile.name,
        isImported: true
      };

      return incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        recoveryPlanText: JSON.stringify(docData),
        recoveryEstimateCost: cost,
      });
    },
    onSuccess: () => {
      toast.success('Đã trình hồ sơ lên Giám đốc phê duyệt');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      onSuccess('Trình hồ sơ thành công');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi nộp báo cáo.');
    }
  });

  const handleDownloadTemplate = () => {
    // Prefill data
    let dateStr = '...................................................';
    if (incident.createdAt) {
      const dateObj = new Date(incident.createdAt);
      if (!isNaN(dateObj.getTime())) {
        dateStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} ngày ${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
      }
    } else if (incident.date) {
      dateStr = incident.date;
    }

    // Clean up description image references
    const descWithoutImages = incident.description?.split('\n').filter(l => !l.startsWith('![')).join('\n').trim() || 'Chưa có mô tả chi tiết';

    const templateHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>Kế hoạch khắc phục sự cố - Dự án ${incident.projectName || ''}</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13pt;
            line-height: 1.5;
            margin: 1in;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .header-table td {
            border: none;
            vertical-align: top;
            font-size: 11pt;
            line-height: 1.3;
          }
          .title {
            text-align: center;
            font-weight: bold;
            font-size: 16pt;
            margin-top: 30px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .subtitle {
            text-align: center;
            font-style: italic;
            font-size: 12pt;
            margin-bottom: 30px;
          }
          h1, h2, h3 {
            font-family: 'Times New Roman', Times, serif;
            margin-top: 15px;
            margin-bottom: 5px;
            font-weight: bold;
          }
          h1 { font-size: 14pt; text-transform: uppercase; }
          h2 { font-size: 13pt; }
          h3 { font-size: 12pt; }
          p, li {
            margin: 0 0 8px 0;
            text-align: left;
          }
          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 50px;
          }
          .signature-table td {
            border: none;
            text-align: center;
            width: 33%;
            font-size: 11pt;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
          }
          .signature-space {
            height: 80px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: center; width: 45%;">
              <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br/>
              Ban Quản lý Dự án: ${incident.projectName || 'Dự án CMS'}<br/>
              -----------------------
            </td>
            <td style="text-align: center; width: 55%;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
              -------------------------<br/>
              <span style="font-style: italic; font-size: 11pt;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
            </td>
          </tr>
        </table>
        
        <div class="title">BÁO CÁO SỰ CỐ CÔNG TRÌNH XÂY DỰNG & KẾ HOẠCH KHẮC PHỤC</div>
        <div class="subtitle">(Tài liệu lập và lưu giữ trên hệ thống CMS)</div>
        
        <div style="text-align: left;">
          <p><strong>1. Thông tin công trình</strong></p>
          <div style="padding-left: 14px;">
            <p style="margin: 4px 0; text-align: left;">- Tên công trình: <strong>${incident.projectName || '...................................................'}</strong></p>
            <p>- Địa chỉ công trình: <strong>...........................................................................</strong></p>
            <p>- Chủ đầu tư: <strong>...........................................................................</strong></p>
            <p>- Nhà thầu thi công: <strong>Công ty Cổ phần Xây dựng BPG</strong></p>
            <p>- Đơn vị tư vấn giám sát: <strong>...........................................................................</strong></p>
          </div>

          <p><strong>2. Thời gian xảy ra sự cố</strong></p>
          <div style="padding-left: 14px;">
            <p>- Ngày, giờ xảy ra: <strong>${dateStr}</strong></p>
          </div>

          <p><strong>3. Mô tả sự cố</strong></p>
          <div style="padding-left: 14px;">
            <p>- Loại sự cố: <strong>Sự cố ngừng thi công khẩn cấp</strong></p>
            <p>- Mô tả chi tiết: <br/><strong>${descWithoutImages.replace(/\n/g, '<br/>')}</strong></p>
            <p>- Nguyên nhân ban đầu (nếu có): <br/><strong>...........................................................................</strong></p>
          </div>

          <p><strong>4. Thiệt hại do sự cố (Khai báo bởi Project Leader)</strong></p>
          <div style="padding-left: 14px;">
            <p>- Thiệt hại về con người: <strong>Không có thiệt hại về người.</strong></p>
            <p>- Thiệt hại về vật chất: <br/><strong>${(incident.damageDescription || 'Chưa khai báo chi tiết').replace(/\n/g, '<br/>')}</strong></p>
            <p>- Thiệt hại ước tính (vật tư/tiền): <strong>${incident.estimatedMaterialLoss ? incident.estimatedMaterialLoss.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ'}</strong></p>
          </div>

          <p><strong>5. Biện pháp khắc phục và đề xuất lâu dài (TPKT bổ sung)</strong></p>
          <div style="padding-left: 14px;">
            <p>- Các hành động khẩn cấp đã thực hiện: <br/><strong>[TPKT Điền thông tin vào đây...]</strong></p>
            <p>- Đề xuất hướng xử lý lâu dài: <br/><strong>[TPKT Điền kế hoạch khắc phục chi tiết vào đây...]</strong></p>
          </div>

          <p><strong>6. Các bên liên quan chứng kiến sự cố</strong></p>
          <div style="padding-left: 14px;">
            <p>- Họ và tên: <strong>...........................................................................</strong></p>
            <p>- Liên hệ (SĐT / Email): <strong>...........................................................................</strong></p>
          </div>

          <p><strong>7. Ý kiến của các bên</strong></p>
          <div style="padding-left: 14px;">
            <p>- Ý kiến của Chủ đầu tư: <br/><strong>...........................................................................</strong></p>
            <p>- Ý kiến của Nhà thầu: <br/><strong>...........................................................................</strong></p>
            <p>- Ý kiến của Tư vấn giám sát: <br/><strong>...........................................................................</strong></p>
          </div>

          <p><strong>8. Kết luận và cam kết</strong></p>
          <div style="padding-left: 14px;">
            <p>Chúng tôi cam kết thông tin trong báo cáo là chính xác và sẽ phối hợp thực hiện các biện pháp khắc phục theo quy định.</p>
          </div>
        </div>

        <div style="text-align: center; font-weight: bold; font-size: 12pt; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase;">
          ĐẠI DIỆN CÁC BÊN THAM GIA LẬP BIÊN BẢN
        </div>
        <table class="signature-table">
          <tr>
            <td>
              <span class="signature-title">Đại diện chủ đầu tư</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện nhà thầu thi công</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>Trưởng phòng Kỹ thuật</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện tư vấn giám sát (nếu có)</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + templateHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mau_Ke_hoach_khac_phuc_Incident_${incident.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đang tải bản mẫu kế hoạch khắc phục Word...');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'doc' && ext !== 'docx') {
      toast.error('Chỉ hỗ trợ tệp định dạng Word (.doc hoặc .docx).');
      return;
    }
    const MAX = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX) {
      toast.error('Kích thước tệp không được vượt quá 20MB.');
      return;
    }
    setSelectedFile(file);
    toast.success(`Đã nhận file: ${file.name}`);
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleSubmitReport = () => {
    if (!selectedFile) {
      toast.error('Vui lòng tải lên tệp kế hoạch Word (.doc/.docx) để import vào hệ thống.');
      return;
    }
    if (cost <= 0) {
      toast.error('Vui lòng nhập ngân sách dự toán khắc phục sự cố.');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📋 Lập Báo cáo & Kế hoạch Khắc phục Sự cố" width="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        
        {/* Banner */}
        <div style={{ padding: '12px 16px', background: 'hsl(var(--primary-glow))', borderRadius: '8px', border: '1px solid hsl(var(--primary)/0.2)' }}>
          <strong style={{ color: 'hsl(var(--primary))', fontSize: '0.88rem', display: 'block' }}>
            Quy trình lập kế hoạch khắc phục sự cố khẩn cấp
          </strong>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
            Bước 1: Tải bản mẫu pre-fill thông tin thiệt hại hiện trường. <br/>
            Bước 2: Hoàn thành phương án khắc phục trên Word và upload (import) lại hệ thống.
          </span>
        </div>

        {/* Step 1: Download template */}
        <div style={{ padding: '14px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', marginBottom: '6px' }}>
            1. Tải bản mẫu từ hệ thống
          </div>
          <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))', marginBottom: '12px' }}>
            Bản mẫu sẽ tự động điền các thông tin về dự án, mô tả sự cố khẩn cấp và các hạng mục thiệt hại do Project Leader khai báo.
          </p>
          <Button variant="outline" onClick={handleDownloadTemplate} style={{ width: '100%', borderColor: 'hsl(var(--primary)/0.5)', color: 'hsl(var(--primary))' }}>
            📝 Tải bản mẫu Word (.doc)
          </Button>
        </div>

        {/* Step 2: Upload file */}
        <FormItem label="2. Tải lên tệp kế hoạch khắc phục (Word)" required>
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                borderRadius: '8px',
                padding: '24px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
                transition: 'all 0.2s ease',
              }}
              onClick={() => document.getElementById('recovery-import-file')?.click()}
            >
              <UploadCloud size={36} style={{ margin: '0 auto 8px', color: 'hsl(var(--text-muted))' }} />
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
                Kéo thả file Word vào đây hoặc click để chọn tệp (.doc, .docx)
              </p>
              <input
                type="file"
                id="recovery-import-file"
                accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'hsl(var(--success-glow))', border: '1px solid hsl(var(--success)/0.3)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={24} style={{ color: 'hsl(var(--success))' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{selectedFile.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(var(--text-secondary))' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
              </div>
              <button
                type="button"
                onClick={removeFile}
                style={{ padding: '4px', background: 'rgba(0,0,0,0.05)', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} style={{ color: 'hsl(var(--text-secondary))' }} />
              </button>
            </div>
          )}
        </FormItem>

        {/* Cost input */}
        <FormItem label="3. Tổng kinh phí khắc phục dự toán (VNĐ)" required>
          <input
            className="input"
            type="number"
            value={cost === 0 ? '' : cost}
            onChange={(e) => setCost(Number(e.target.value))}
            placeholder="Ví dụ: 150000000"
          />
        </FormItem>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitReport}
            isLoading={mutation.isPending}
            disabled={!selectedFile || cost <= 0 || mutation.isPending}
          >
            Nộp kế hoạch trình Giám đốc
          </Button>
        </div>
      </div>
    </Modal>
  );
};
