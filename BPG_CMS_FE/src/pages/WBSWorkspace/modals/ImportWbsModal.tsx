import React, { useState } from 'react';
import { useWBS } from '../components/WBSContext';
import { wbsService } from '../../../services/wbsService';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const ImportWbsModal: React.FC = () => {
  const { isImportWbsOpen, setIsImportWbsOpen, projectId, loadWBSData, handleSuccess, handleError } = useWBS();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);

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
    setPreviewResult(null);
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
      setPreviewResult(null);
      setImportResult(null);
      
      // Auto preview when file is selected
      handlePreviewFile(file);
    }
  };

  const handlePreviewFile = async (file: File) => {
    setIsPreviewing(true);
    setPreviewResult(null);
    try {
      const result = await wbsService.previewWbsImport(projectId, file);
      setPreviewResult(result);
    } catch (error: any) {
      handleError(error.message || 'Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
    } finally {
      setIsPreviewing(false);
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
        handleSuccess('Nhập cấu trúc công việc thành công!');
        loadWBSData();
      }
    } catch (error: any) {
      handleError(error.message || 'Lỗi khi nhập tệp Excel');
    } finally {
      setIsUploading(false);
    }
  };

  const getPriorityText = (weight?: number) => {
    switch (weight) {
      case 1: return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs border border-slate-200">Bình thường</span>;
      case 2: return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs border border-blue-200">Cao</span>;
      case 3: return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs border border-orange-200">Quan trọng</span>;
      case 4: return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs border border-red-200 font-medium">Rất quan trọng</span>;
      default: return null;
    }
  };

  const renderPreviewRows = () => {
    if (!previewResult || !previewResult.phases) return null;
    const rows: React.ReactNode[] = [];
    previewResult.phases.forEach((p: any) => {
      rows.push(
        <tr key={`p-${p.wbsCode}`} className="bg-slate-50/80 hover:bg-slate-100 font-medium text-[13px]">
          <td className="px-4 py-2 font-bold text-slate-700 w-20 border-b border-slate-100">{p.wbsCode}</td>
          <td className="px-4 py-2 text-[hsl(var(--primary))] border-b border-slate-100 min-w-[200px]">{p.name}</td>
          <td className="px-4 py-2 text-slate-500 border-b border-slate-100 truncate max-w-[200px]" title={p.description}>{p.description}</td>
          <td className="px-4 py-2 text-slate-600 border-b border-slate-100">{p.startDate}</td>
          <td className="px-4 py-2 text-slate-600 border-b border-slate-100">{p.endDate}</td>
          <td className="px-4 py-2 border-b border-slate-100"></td>
          <td className="px-4 py-2 border-b border-slate-100"></td>
          <td className="px-4 py-2 border-b border-slate-100"></td>
          <td className="px-4 py-2 border-b border-slate-100"></td>
        </tr>
      );
      p.tasks?.forEach((t: any) => {
        rows.push(
          <tr key={`t-${t.wbsCode}`} className="hover:bg-slate-50 text-[13px]">
            <td className="px-4 py-2 pl-6 text-slate-600 w-20 border-b border-slate-50">{t.wbsCode}</td>
            <td className="px-4 py-2 text-slate-800 border-b border-slate-50 min-w-[200px]">{t.name}</td>
            <td className="px-4 py-2 text-slate-500 border-b border-slate-50 truncate max-w-[200px]" title={t.description}>{t.description}</td>
            <td className="px-4 py-2 text-slate-500 border-b border-slate-50">{t.startDate}</td>
            <td className="px-4 py-2 text-slate-500 border-b border-slate-50">{t.endDate}</td>
            <td className="px-4 py-2 border-b border-slate-50">{getPriorityText(t.weight)}</td>
            <td className="px-4 py-2 border-b border-slate-50">
              {t.isOutsourced && <span className="text-amber-600 font-medium text-xs">Thuê ngoài {t.outsourcedTeamName && `(${t.outsourcedTeamName})`}</span>}
            </td>
            <td className="px-4 py-2 text-slate-600 border-b border-slate-50 min-w-[150px] whitespace-normal">{t.assignees?.join(', ')}</td>
            <td className="px-4 py-2 text-slate-500 border-b border-slate-50">{t.predecessors?.join(', ')}</td>
          </tr>
        );
        t.subTasks?.forEach((st: any) => {
          rows.push(
            <tr key={`st-${st.wbsCode}`} className="hover:bg-slate-50 text-[13px]">
              <td className="px-4 py-2 pl-10 text-slate-500 w-20 border-b border-slate-50">{st.wbsCode}</td>
              <td className="px-4 py-2 text-slate-600 border-b border-slate-50 min-w-[200px]">{st.name}</td>
              <td className="px-4 py-2 text-slate-400 border-b border-slate-50 truncate max-w-[200px]" title={st.description}>{st.description}</td>
              <td className="px-4 py-2 text-slate-400 border-b border-slate-50">{st.startDate}</td>
              <td className="px-4 py-2 text-slate-400 border-b border-slate-50">{st.endDate}</td>
              <td className="px-4 py-2 border-b border-slate-50">{getPriorityText(st.weight)}</td>
              <td className="px-4 py-2 border-b border-slate-50">
                {st.isOutsourced && <span className="text-amber-600 font-medium text-xs">Thuê ngoài {st.outsourcedTeamName && `(${st.outsourcedTeamName})`}</span>}
              </td>
              <td className="px-4 py-2 text-slate-500 border-b border-slate-50 min-w-[150px] whitespace-normal">{st.assignees?.join(', ')}</td>
              <td className="px-4 py-2 text-slate-400 border-b border-slate-50">{st.predecessors?.join(', ')}</td>
            </tr>
          );
        });
      });
    });
    return rows;
  };

  const hasErrors = previewResult && previewResult.errors && previewResult.errors.length > 0;
  const showPreview = !!previewResult || isPreviewing;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose}></div>
      <div className={`bg-white rounded-lg shadow-xl w-full ${showPreview && !importResult ? 'max-w-[95vw]' : 'max-w-2xl'} overflow-hidden relative z-10 flex flex-col h-[90vh] transition-all duration-300`}>
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 m-0 flex items-center gap-2">
            Nhập cấu trúc công việc từ Excel
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {importResult ? (
            <div className="p-8 flex-1 overflow-y-auto flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center py-6 text-center max-w-lg mx-auto">
                {importResult.phaseCount > 0 || importResult.taskCount > 0 ? (
                  <>
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                      <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">Nhập dữ liệu thành công!</h3>
                    <p className="text-slate-500 mt-3 text-lg">
                      Đã tạo <strong>{importResult.phaseCount}</strong> giai đoạn và <strong>{importResult.taskCount}</strong> công việc.
                      {importResult.skippedCount > 0 && ` Bỏ qua ${importResult.skippedCount} dòng trống.`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
                      <AlertCircle size={40} />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">Không có dữ liệu nào được nhập</h3>
                    <p className="text-slate-500 mt-3 text-lg">Vui lòng kiểm tra lại tệp của bạn và sửa các lỗi bên dưới.</p>
                  </>
                )}
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-5 w-full max-w-2xl mt-4">
                  <h4 className="font-bold text-red-700 mb-3 flex items-center gap-2 text-lg">
                    <AlertCircle size={20} /> Các lỗi phát sinh ({importResult.errors.length}):
                  </h4>
                  <ul className="list-disc pl-5 text-red-600 space-y-1.5 max-h-60 overflow-y-auto pr-2">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* LEFT SIDE: UPLOAD FORM */}
              <div className={`p-6 overflow-y-auto flex flex-col gap-6 ${showPreview ? 'md:w-[400px] lg:w-[450px] border-r border-slate-200 bg-slate-50/30' : 'w-full'}`}>
                
                <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-4 text-[13px] text-blue-900 shadow-sm">
                  <p className="mb-2 text-blue-950 font-bold flex items-center gap-1.5 text-sm">
                    <AlertCircle size={16} className="text-blue-600" /> Lưu ý quan trọng
                  </p>
                  <ul className="list-disc pl-5 space-y-1.5 marker:text-blue-400">
                    <li>Sử dụng đúng <button type="button" onClick={handleDownloadTemplate} className="text-blue-600 font-semibold hover:underline">Tệp mẫu</button> và không đổi tên cột.</li>
                    <li>Sử dụng <strong>Chỉ mục</strong> để phân cấp. Ví dụ: 1 ➔ 1.1 ➔ 1.1.1</li>
                    <li className="text-red-700 font-semibold">CHỈ hỗ trợ cấu trúc công việc tối đa 3 cấp.</li>
                    <li>Thời gian công việc con phải nằm trong công việc cha.</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2 text-slate-800">
                    Tệp Excel chứa cấu trúc công việc
                  </label>
                  <div className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-all
                    ${selectedFile ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'}`}>
                    <div className="space-y-2 text-center w-full">
                      {selectedFile ? (
                         <div className="flex flex-col items-center justify-center relative py-2">
                            <FileText className="h-12 w-12 text-emerald-500 mb-3 drop-shadow-sm" />
                            <span className="text-sm font-bold text-slate-800 truncate max-w-full px-4 mb-1">{selectedFile.name}</span>
                            <span className="text-xs text-slate-500 font-medium bg-white px-2 py-0.5 rounded-full border border-slate-200">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            <div className="mt-4 flex gap-2 w-full">
                               <button type="button" onClick={() => setSelectedFile(null)} className="flex-1 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-red-600 transition-colors">
                                 Hủy bỏ
                               </button>
                               <label htmlFor="file-upload-replace" className="flex-1 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded hover:bg-blue-50 cursor-pointer transition-colors text-center">
                                 Chọn lại
                                 <input id="file-upload-replace" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                               </label>
                            </div>
                         </div>
                      ) : (
                         <>
                            <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                            <div className="flex text-sm text-slate-600 justify-center font-medium">
                              <label htmlFor="file-upload" className="relative cursor-pointer text-blue-600 hover:text-blue-700 hover:underline focus-within:outline-none">
                                <span>Tải file lên</span>
                                <input id="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} />
                              </label>
                              <p className="pl-1">hoặc kéo thả</p>
                            </div>
                            <p className="text-xs text-slate-500 font-medium">.xlsx, .xls</p>
                         </>
                      )}
                    </div>
                  </div>
                </div>

                {hasErrors && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-auto shadow-sm">
                    <h4 className="font-bold text-red-700 mb-2 flex items-center gap-1.5 text-[13px]">
                      <AlertCircle size={14} /> Có {previewResult.errors.length} lỗi trong file
                    </h4>
                    <p className="text-xs text-red-600 font-medium mb-3">Vui lòng sửa các lỗi sau và tải lên lại:</p>
                    <ul className="list-disc pl-4 text-xs text-red-600 space-y-1.5 max-h-40 overflow-y-auto pr-2">
                      {previewResult.errors.map((err: string, idx: number) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {previewResult && !hasErrors && (
                   <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mt-auto shadow-sm">
                      <h4 className="font-bold text-emerald-700 flex items-center gap-1.5 text-sm mb-1">
                        <CheckCircle2 size={16} /> Dữ liệu hợp lệ!
                      </h4>
                      <p className="text-[13px] text-emerald-600">Bạn có thể ấn <strong>Nhập dữ liệu</strong> để ghi dữ liệu vào hệ thống.</p>
                   </div>
                )}
              </div>

              {/* RIGHT SIDE: PREVIEW TABLE */}
              {showPreview && (
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="font-bold text-slate-800 text-[15px]">Xem trước dữ liệu</h3>
                     
                     {previewResult && (
                        <div className="flex gap-3 text-[13px]">
                           <span className="bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                              <span className="font-bold">{previewResult.phaseCount}</span> Giai đoạn
                           </span>
                           <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 rounded-full font-medium">
                              <span className="font-bold">{previewResult.taskCount}</span> Công việc
                           </span>
                           {previewResult.skippedCount > 0 && (
                              <span className="bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                                 Bỏ qua <span className="font-bold">{previewResult.skippedCount}</span> dòng
                              </span>
                           )}
                        </div>
                     )}
                  </div>
                  
                  <div className="flex-1 overflow-auto p-4 bg-slate-50/30">
                     {isPreviewing ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                           <Loader2 size={40} className="animate-spin mb-4 text-blue-500" />
                           <p className="font-medium text-slate-600">Đang phân tích file Excel...</p>
                        </div>
                     ) : previewResult?.phases && previewResult.phases.length > 0 ? (
                        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white h-full flex flex-col">
                           <div className="overflow-auto flex-1">
                              <table className="w-full text-left whitespace-nowrap min-w-[1200px]">
                                <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 text-[13px] shadow-sm">
                                  <tr>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Chỉ mục</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Tên công việc / Giai đoạn</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Mô tả</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Bắt đầu</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Kết thúc</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Mức độ ưu tiên</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Thuê ngoài</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Người được giao</th>
                                    <th className="px-4 py-3 font-semibold border-b border-slate-200">Hoàn thành trước</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white">
                                  {renderPreviewRows()}
                                </tbody>
                              </table>
                           </div>
                        </div>
                     ) : null}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/80">
          {importResult ? (
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 bg-slate-800 rounded-md text-[14px] font-semibold text-white hover:bg-slate-900 transition-colors shadow-sm"
            >
              Đóng lại
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2 border border-slate-300 bg-white rounded-md text-[14px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm"
              >
                Hủy bỏ
              </button>
              
              <button
                type="button"
                onClick={handleImport}
                disabled={!selectedFile || isUploading || hasErrors || isPreviewing}
                className={`px-6 py-2 rounded-md text-[14px] font-semibold flex items-center justify-center gap-2 text-white transition-all shadow-sm
                  ${(!selectedFile || isUploading || hasErrors || isPreviewing)
                    ? 'bg-slate-300 cursor-not-allowed opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow'
                  }`}
              >
                {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Đang nhập dữ liệu...</> : 'Nhập dữ liệu'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

