import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, Badge } from '../../../components/ui';
import { supplierService } from '../../../services/supplierService';
import type { ImportSuppliersResult } from '../../../types/supplier';
import { UploadCloud, FileSpreadsheet, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'select' | 'result';

export const ImportSupplierModal: React.FC<ImportSupplierModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>('select');
  const [result, setResult] = useState<ImportSuppliersResult | null>(null);

  const importMutation = useMutation({
    mutationFn: (f: File) => supplierService.importSuppliers(f),
    onSuccess: (res) => {
      setResult(res.data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Import thất bại, vui lòng thử lại.');
    },
  });

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Chỉ chấp nhận file .xlsx hoặc .xls');
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleClose = () => {
    setFile(null);
    setStep('select');
    setResult(null);
    onClose();
  };

  const downloadTemplate = () => {
    const rows = [
      'STT,Tên nhà cung cấp (*),Thông tin liên hệ,Địa chỉ,Khu vực phục vụ,Đánh giá (0-5),Ghi chú đánh giá',
      '1,Công ty TNHH ABC,0901234567,Số 1 Lê Lợi - Q.1 - TP.HCM,TP. Hồ Chí Minh,4.5,Nhà cung cấp uy tín',
      '2,Nhà cung cấp XYZ,0912345678,123 Nguyễn Huệ - Hà Nội,Hà Nội,,',
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_nha_cung_cap.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const footer = step === 'select' ? (
    <>
      <Button variant="secondary" onClick={handleClose}>Hủy</Button>
      <Button
        variant="primary"
        disabled={!file}
        isLoading={importMutation.isPending}
        onClick={() => file && importMutation.mutate(file)}
      >
        <UploadCloud size={15} style={{ marginRight: 6 }} />
        Import
      </Button>
    </>
  ) : (
    <Button variant="primary" onClick={handleClose}>Đóng</Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import nhà cung cấp từ Excel"
      footer={footer}
      width="md"
    >
      {step === 'select' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={downloadTemplate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--primary))', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Download size={13} /> Tải file mẫu (CSV)
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              borderRadius: 'var(--radius-md)',
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              background: dragOver ? 'hsl(var(--primary-glow))' : undefined,
              transition: 'all 0.2s',
            }}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <FileSpreadsheet size={32} color={dragOver ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))'} />
            {file ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{file.name}</p>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{(file.size / 1024).toFixed(1)} KB — Nhấn để đổi file</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 500, fontSize: 14 }}>Kéo thả file vào đây</p>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>hoặc nhấn để chọn file .xlsx / .xls</p>
              </div>
            )}
          </div>

          {/* Format guide */}
          <div className="glass-panel" style={{ fontSize: 12, lineHeight: 1.8 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Định dạng file Excel:</p>
            <p>• Dòng 1 là <strong>header</strong> (bỏ qua khi import)</p>
            <p>• Cột B: Tên nhà cung cấp <span style={{ color: 'hsl(var(--danger))' }}>(*bắt buộc)</span></p>
            <p>• Cột C: Liên hệ &nbsp;|&nbsp; D: Địa chỉ &nbsp;|&nbsp; E: Khu vực &nbsp;|&nbsp; F: Đánh giá (0–5) &nbsp;|&nbsp; G: Ghi chú</p>
            <p>• Nhà cung cấp <strong>trùng tên</strong> sẽ bị bỏ qua tự động</p>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge variant="success" className="text-lg px-3 py-1">{result.successCount}</Badge>
              <span style={{ fontSize: 13 }}>Thêm mới thành công</span>
            </div>
            <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge variant="warning" className="text-lg px-3 py-1">{result.skippedCount}</Badge>
              <span style={{ fontSize: 13 }}>Bỏ qua (trùng tên)</span>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="glass-panel" style={{ maxHeight: 180, overflowY: 'auto' }}>
              <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: 'hsl(var(--danger))' }}>
                Chi tiết dòng bị bỏ qua / lỗi ({result.errors.length})
              </p>
              {result.errors.map((e, i) => (
                <p key={i} style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>• {e}</p>
              ))}
            </div>
          )}

          {result.successCount === 0 && result.skippedCount === 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              File không có dữ liệu nào để import.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};
