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
      toast.error(err.message || 'Thêm dữ liệu thất bại, vui lòng thử lại.');
    },
  });

  const templateMutation = useMutation({
    mutationFn: () => supplierService.downloadTemplate(),
    onError: (err: Error) => toast.error(err.message || 'Không thể tải file mẫu.'),
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

  const downloadTemplate = () => templateMutation.mutate();

  const footer = step === 'select' ? (
    <>
      <Button variant="secondary" onClick={handleClose}>Hủy</Button>
      <Button
        variant="primary"
        disabled={!file}
        isLoading={importMutation.isPending}
        onClick={() => file && importMutation.mutate(file)}
      >
        <UploadCloud size={15} className="mr-1.5" />
        Thêm dữ liệu
      </Button>
    </>
  ) : (
    <Button variant="primary" onClick={handleClose}>Đóng</Button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Thêm danh sách Nhà cung cấp"
      footer={footer}
      width="md"
    >
      {step === 'select' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Download size={14} /> Tải file Excel mẫu
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
            <FileSpreadsheet size={36} className={dragOver ? 'text-blue-500' : 'text-slate-400'} />
            {file ? (
              <div className="text-center">
                <p className="font-semibold text-sm text-slate-700">{file.name}</p>
                <p className="text-xs text-slate-500 mt-1">{(file.size / 1024).toFixed(1)} KB — Nhấn để chọn file khác</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="font-medium text-sm text-slate-700">Kéo thả file vào đây</p>
                <p className="text-xs text-slate-500 mt-1">hoặc nhấn để chọn file .xlsx / .xls từ máy</p>
              </div>
            )}
          </div>

          {/* Format guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-1">Hướng dẫn định dạng file:</p>
            <p>• Dòng 1 là <strong>dòng tiêu đề</strong> (hệ thống sẽ tự bỏ qua khi thêm)</p>
            <p>• Cột B: Tên nhà cung cấp <span className="text-rose-600 font-medium">(*bắt buộc)</span></p>
            <p>• Các cột còn lại (Liên hệ, Địa chỉ, Khu vực...) có thể để trống</p>
            <p>• Nếu <strong>trùng Tên</strong> với nhà cung cấp đã có, hệ thống sẽ tự động bỏ qua</p>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3.5 flex items-center gap-3">
              <Badge variant="success" className="text-sm px-2.5 py-0.5">{result.successCount}</Badge>
              <span className="text-sm font-medium text-emerald-800">Thêm mới thành công</span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3.5 flex items-center gap-3">
              <Badge variant="warning" className="text-sm px-2.5 py-0.5">{result.skippedCount}</Badge>
              <span className="text-sm font-medium text-amber-800">Bỏ qua (trùng lặp/lỗi)</span>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="font-semibold text-xs text-rose-700 mb-2">
                Chi tiết các dòng không thể thêm ({result.errors.length}):
              </p>
              <ul className="list-disc list-inside text-xs text-rose-600 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {result.successCount === 0 && result.skippedCount === 0 && (
            <p className="text-center text-sm text-slate-500 py-4">
              Không tìm thấy dữ liệu hợp lệ nào trong file.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};
