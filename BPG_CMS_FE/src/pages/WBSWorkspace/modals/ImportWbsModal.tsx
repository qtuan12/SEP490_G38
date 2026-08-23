import React, { useState } from 'react';
import { useWBS } from '../components/WBSContext';
import { wbsService } from '../../../services/wbsService';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const ImportWbsModal: React.FC = () => {
  const { isImportWbsOpen, setIsImportWbsOpen, projectId, loadWBSData, handleSuccess, handleError } = useWBS();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<{
    phaseCount: number;
    taskCount: number;
    skippedCount: number;
    errors: string[];
  } | null>(null);

  if (!isImportWbsOpen) return null;

  const handleClose = () => {
    setIsImportWbsOpen(false);
    setSelectedFile(null);
    setImportResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        handleError('Chỉ chấp nhận file Excel (.xlsx, .xls)');
        return;
      }
      setSelectedFile(file);
      setImportResult(null); // clear previous result
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await wbsService.downloadWbsTemplate();
    } catch (error: any) {
      handleError(error.message || 'Lỗi khi tải file mẫu');
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setImportResult(null);
    try {
      const result = await wbsService.importWbs(projectId, selectedFile);
      setImportResult(result);
      if (result.phaseCount > 0 || result.taskCount > 0) {
        handleSuccess('Import dữ liệu WBS thành công!');
        loadWBSData();
      }
    } catch (error: any) {
      handleError(error.message || 'Lỗi khi import file Excel');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose}></div>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden relative z-10 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex justify-between items-center bg-[hsl(var(--bg-main))]">
          <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))] m-0">Import Cấu trúc WBS từ Excel</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {importResult ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-6 text-center">
                {importResult.phaseCount > 0 || importResult.taskCount > 0 ? (
                  <>
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-[hsl(var(--text-primary))]">Import thành công!</h3>
                    <p className="text-slate-500 mt-2">
                      Đã tạo <strong>{importResult.phaseCount}</strong> giai đoạn và <strong>{importResult.taskCount}</strong> công việc.
                      {importResult.skippedCount > 0 && ` Bỏ qua ${importResult.skippedCount} dòng.`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-4">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-[hsl(var(--text-primary))]">Không có dữ liệu nào được import</h3>
                    <p className="text-slate-500 mt-2">Vui lòng kiểm tra lại file của bạn và lỗi bên dưới.</p>
                  </>
                )}
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded p-4">
                  <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} /> Các lỗi phát sinh ({importResult.errors.length}):
                  </h4>
                  <ul className="list-disc pl-5 text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded p-4 text-sm text-blue-800">
                <p className="mb-2"><strong>Lưu ý quan trọng:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Vui lòng tải file mẫu và điền dữ liệu theo đúng cấu trúc.</li>
                  <li>Không thay đổi tên hoặc thứ tự các cột ở dòng đầu tiên (Header).</li>
                  <li>Sử dụng <strong>Mã WBS</strong> để phân cấp. Ví dụ: `1` (Giai đoạn) ➔ `1.1` (Công việc) ➔ `1.1.1` (Công việc con).</li>
                  <li className="text-red-700 font-medium">Hệ thống BPG CMS CHỈ hỗ trợ cấu trúc WBS tối đa 3 cấp. Nếu bạn tạo cấp thứ 4 (ví dụ 1.1.1.1) sẽ bị báo lỗi.</li>
                  <li>Thời gian của công việc/công việc con phải nằm trong thời gian của Giai đoạn/Công việc cha.</li>
                </ul>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="mt-3 text-blue-600 font-medium hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  <FileText size={16} /> Tải file mẫu Excel (.xlsx)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-[hsl(var(--text-primary))]">
                  Chọn file Excel cần import
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-[hsl(var(--border))] border-dashed rounded-md bg-[hsl(var(--bg-main))] hover:bg-[hsl(var(--border-light))] transition-colors relative">
                  <div className="space-y-1 text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] focus-within:outline-none">
                        <span>Tải file lên</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                      </label>
                      <p className="pl-1">hoặc kéo thả vào đây</p>
                    </div>
                    <p className="text-xs text-slate-500">Chỉ hỗ trợ file Excel (.xlsx, .xls)</p>
                  </div>
                  {selectedFile && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-4">
                      <FileText className="h-10 w-10 text-emerald-500 mb-2" />
                      <span className="text-sm font-medium text-slate-700 truncate max-w-full px-4">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedFile(null)}
                        className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Chọn file khác
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[hsl(var(--border))] flex justify-end gap-3 bg-[hsl(var(--bg-main))]">
          {!importResult ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-[hsl(var(--border))] rounded text-[0.85rem] font-medium text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--border-light))] transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || isUploading}
                className={`px-4 py-2 rounded text-[0.85rem] font-medium flex items-center justify-center gap-2 text-white transition-colors
                  ${(!selectedFile || isUploading)
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-dark))]'
                  }`}
              >
                {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang xử lý...</> : 'Import dữ liệu'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-[hsl(var(--primary))] rounded text-[0.85rem] font-medium text-white hover:bg-[hsl(var(--primary-dark))] transition-colors"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
