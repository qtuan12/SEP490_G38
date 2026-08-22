import React, { useState, useEffect } from 'react';
import { Modal, Button, FormItem } from '../../../components/ui';
import { inventoryAdjustmentService } from '../../../services/inventoryAdjustmentService';
import { masterDataService } from '../../../services/masterDataService';
import { projectService } from '../../../services/projectService';
import { directPurchaseService } from '../../../services/directPurchaseService';
import type { PhaseBOQItemDto } from '../../../services/directPurchaseService';
import type { MaterialCatalog } from '../../../types/masterData';
import { Search, X, UploadCloud } from 'lucide-react';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { compressAndUploadFile, type UploadedFileState } from '../../../utils/uploadHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  onError?: (msg: string) => void;
  projectId: number;
}

export const CreateIncreaseAdjustmentModal: React.FC<Props> = ({ isOpen, onClose, onSuccess, projectId }) => {
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialCatalog[]>([]);
  const [phases, setPhases] = useState<any[]>([]);

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [phaseId, setPhaseId] = useState<number | ''>('');
  const [boqMaterials, setBoqMaterials] = useState<PhaseBOQItemDto[]>([]);
  const [loadingBOQ, setLoadingBOQ] = useState(false);
  const [items, setItems] = useState<{ materialId: number; unitId: number; quantity: number }[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<UploadedFileState | null>(null);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      loadMaterials();
      loadPhases();
      setReason('');
      setDescription('');
      setPhaseId('');
      setBoqMaterials([]);
      setItems([]);
      setEvidenceFile(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!phaseId) {
      setBoqMaterials([]);
      setSelectedMaterialId('');
      setSearchKeyword('');
      setIsDropdownOpen(false);
      return;
    }
    setLoadingBOQ(true);
    setSelectedMaterialId('');
    setSearchKeyword('');
    setIsDropdownOpen(false);
    directPurchaseService
      .getPhaseBOQ(projectId, Number(phaseId))
      .then(res => {
        setBoqMaterials(res || []);
      })
      .catch(err => {
        console.error('Lỗi khi tải BOQ theo giai đoạn:', err);
        setBoqMaterials([]);
      })
      .finally(() => setLoadingBOQ(false));
  }, [phaseId, projectId]);

  const loadPhases = async () => {
    try {
      const phaseData = await projectService.getPhases(projectId.toString());
      const activePhases = (phaseData || []).filter((ph: any) => {
        const s = (ph.status || '').toLowerCase();
        const rawS = (ph.rawStatus || '').toLowerCase();
        const progress = ph.progress ?? ph.progressPercent ?? 0;
        const isFinished = s === 'frozen' || s === 'completed' || s === 'approved' || rawS === 'completed' || rawS === 'approved' || progress >= 100;
        return !isFinished;
      });
      setPhases(activePhases);
    } catch (err) {
      console.error('Failed to load phases:', err);
    }
  };

  const loadMaterials = async () => {
    try {
      const res = await masterDataService.getMaterials({ pageSize: 1000 });
      setMaterials(res.items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItem = () => {
    if (!selectedMaterialId) {
      setLocalError('Vui lòng chọn vật tư.');
      return;
    }

    if (selectedQuantity === '' || isNaN(Number(selectedQuantity)) || Number(selectedQuantity) <= 0) {
      setLocalError('Số lượng tăng phải là số dương lớn hơn 0.');
      return;
    }

    // Check if already exists
    if (items.some(x => x.materialId === Number(selectedMaterialId))) {
      setLocalError('Vật tư này đã được chọn.');
      return;
    }

    const selectedBoqMaterial = boqMaterials.find(x => x.materialId === Number(selectedMaterialId));
    const selectedCatalog = materials.find(x => x.materialId === Number(selectedMaterialId));
    const unitName = selectedBoqMaterial?.unitName || selectedCatalog?.baseUnitName || '';
    const unitId = selectedBoqMaterial?.unitId ?? selectedCatalog?.baseUnitId;

    if (!unitId) {
      setLocalError('Vật tư chưa cấu hình đơn vị tính.');
      return;
    }

    if (unitName && isDiscreteUnit(unitName) && Number(selectedQuantity) % 1 !== 0) {
      setLocalError(`Đơn vị '${unitName}' yêu cầu số lượng phải là số nguyên.`);
      return;
    }

    setLocalError(null);
    setItems([...items, {
      materialId: Number(selectedMaterialId),
      unitId,
      quantity: Number(selectedQuantity)
    }]);
    setSelectedMaterialId('');
    setSelectedQuantity('');
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(x => x.materialId !== id));
  };

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const newFileState: UploadedFileState = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        status: 'uploading',
        file
      };
      setEvidenceFile(newFileState);
      
      compressAndUploadFile(
        file,
        'general',
        (url) => {
          setEvidenceFile(prev => prev ? { ...prev, status: 'success', url } : null);
        },
        (errorMessage) => {
          setEvidenceFile(prev => prev ? { ...prev, status: 'error', errorMessage } : null);
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phaseId) {
      setLocalError('Vui lòng chọn giai đoạn.');
      return;
    }
    if (!reason.trim()) {
      setLocalError('Vui lòng nhập lý do điều chỉnh.');
      return;
    }
    if (items.length === 0) {
      setLocalError('Vui lòng thêm ít nhất 1 vật tư.');
      return;
    }
    if (!evidenceFile || evidenceFile.status !== 'success' || !evidenceFile.url) {
      setLocalError('Vui lòng đính kèm ảnh bằng chứng hợp lệ.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    try {
      const result = await inventoryAdjustmentService.createIncrease(projectId, {
        phaseId: Number(phaseId),
        reason,
        description,
        evidenceUrl: evidenceFile.url,
        items
      });
      onSuccess(result.message);
    } catch (err: any) {
      setLocalError(err.message || 'Không thể tạo phiếu tăng tồn.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Tăng Tồn Kho " width="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {localError && (
          <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
            {localError}
          </div>
        )}

        <FormItem label="Chọn giai đoạn (*)">
          <select
            className="w-full px-3 py-2 border rounded-lg"
            value={phaseId}
            onChange={e => {
              setPhaseId(e.target.value ? Number(e.target.value) : '');
              setSelectedMaterialId('');
              setSelectedQuantity('');
              setSearchKeyword('');
              setIsDropdownOpen(false);
              setItems([]);
            }}
          >
            <option value="">-- Chọn giai đoạn --</option>
            {phases.map(ph => {
              const numId = typeof ph.id === 'string' ? parseInt(ph.id.replace('ph-', '')) || ph.id : ph.id;
              return (
                <option key={ph.id} value={numId}>{ph.name}</option>
              );
            })}
          </select>
        </FormItem>

        <FormItem label="Lý do điều chỉnh (*)">
          <input
            type="text"
            className="w-full px-3 py-2 border rounded-lg"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="VD: Nhập thêm vật tư từ kho tổng..."
          />
        </FormItem>

        <FormItem label="Mô tả / Ghi chú">
          <textarea
            className="w-full px-3 py-2 border rounded-lg"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </FormItem>

        <FormItem label="Ảnh bằng chứng (*)">
          <div className="flex items-center gap-4">
            <label className={`cursor-pointer flex items-center justify-center w-32 h-20 border-2 border-dashed rounded-lg hover:bg-gray-50 transition-colors ${evidenceFile && evidenceFile.status === 'success' ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}>
              <input type="file" className="hidden" accept="image/*" onChange={handleEvidenceFileChange} />
              <div className="flex flex-col items-center gap-1 text-gray-500">
                <UploadCloud size={20} />
                <span className="text-xs font-medium">Tải ảnh lên</span>
              </div>
            </label>
            {evidenceFile && (
              <div className="flex-1 min-w-0 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {evidenceFile.status === 'uploading' && <span className="text-sm text-blue-600 font-medium animate-pulse">Đang tải...</span>}
                {evidenceFile.status === 'success' && (
                  <div className="flex items-center gap-3 min-w-0">
                    {evidenceFile.url && (
                      <img 
                        src={evidenceFile.url} 
                        alt="Thumbnail" 
                        className="w-12 h-12 object-cover rounded shadow-sm border border-gray-200 shrink-0" 
                      />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-green-600 font-medium">Tải lên thành công</span>
                      <span className="text-xs text-gray-500 truncate">{evidenceFile.name}</span>
                    </div>
                  </div>
                )}
                {evidenceFile.status === 'error' && <span className="text-sm text-red-600 font-medium truncate">Lỗi: {evidenceFile.errorMessage}</span>}
                <button type="button" onClick={() => setEvidenceFile(null)} className="ml-auto text-gray-400 hover:text-red-500"><X size={16} /></button>
              </div>
            )}
          </div>
        </FormItem>

        <div className="border border-gray-800 rounded-2xl p-5 bg-white flex flex-col gap-3">
          <h4 className="font-semibold text-sm">Thêm vật tư (Theo BOQ Giai đoạn đã chọn)</h4>
          <div className="flex flex-col gap-3 p-3.5 bg-slate-50 border border-gray-200 rounded-xl">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_90px] gap-3 items-end">
              {/* Search Input */}
              <div>
                <FormItem label="Tìm kiếm vật tư cần tăng">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder={
                        !phaseId
                          ? "-- Vui lòng chọn Giai đoạn trước --"
                          : loadingBOQ
                          ? "Đang tải danh sách vật tư BOQ..."
                          : "Tìm theo mã hoặc tên vật tư..."
                      }
                      className="w-full pl-9 pr-8 py-2 border rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      value={searchKeyword}
                      onChange={e => {
                        setSearchKeyword(e.target.value);
                        setSelectedMaterialId('');
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => {
                        if (phaseId && !loadingBOQ) setIsDropdownOpen(true);
                      }}
                      disabled={!phaseId || loadingBOQ}
                    />
                    {searchKeyword && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchKeyword('');
                          setSelectedMaterialId('');
                        }}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </FormItem>
              </div>

              {/* Quantity Input */}
              <div>
                <FormItem label="Số lượng tăng">
                  <input
                    type="number"
                    placeholder="0"
                    step={(() => {
                      const selBoq = boqMaterials.find(m => m.materialId === Number(selectedMaterialId));
                      const selCat = materials.find(m => m.materialId === Number(selectedMaterialId));
                      const unitName = selBoq?.unitName || selCat?.baseUnitName || '';
                      return unitName && isDiscreteUnit(unitName) ? "1" : "any";
                    })()}
                    className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100 disabled:cursor-not-allowed text-sm bg-white"
                    value={selectedQuantity}
                    onChange={e => setSelectedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={!phaseId || !selectedMaterialId}
                  />
                </FormItem>
              </div>

              {/* Add Button */}
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={!phaseId || !selectedMaterialId || !selectedQuantity}
                className="h-[38px] px-4 font-medium"
              >
                Thêm
              </Button>
            </div>

            {/* Selected Material Banner */}
            {selectedMaterialId && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-2 px-3 text-xs animate-fade-in">
                <div className="flex items-center gap-2 text-blue-900 font-medium">
                  <span className="font-semibold text-blue-700">Đã chọn:</span>
                  <span>{searchKeyword}</span>
                </div>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 font-semibold hover:underline text-[11px]"
                  onClick={() => {
                    setSelectedMaterialId('');
                    setSearchKeyword('');
                    setIsDropdownOpen(true);
                  }}
                >
                  Đổi vật tư khác
                </button>
              </div>
            )}

            {/* Inline Material Choice List Box */}
            {isDropdownOpen && phaseId && !loadingBOQ && !selectedMaterialId && (
              <div className="flex flex-col gap-1 mt-1 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {searchKeyword.trim() ? "Kết quả tìm kiếm vật tư:" : (boqMaterials.length > 0 ? "Vật tư thuộc BOQ giai đoạn (Nhấn để chọn):" : "Tất cả vật tư danh mục (Nhấn để chọn):")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(false)}
                    className="text-[11px] text-gray-400 hover:text-gray-600 font-medium"
                  >
                    Đóng danh sách ✖
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-xl divide-y divide-gray-100 shadow-sm">
                  {(() => {
                    const searchLower = searchKeyword.toLowerCase().trim();
                    const matchedBoq = boqMaterials.filter(m =>
                      !searchLower ||
                      m.materialCode.toLowerCase().includes(searchLower) ||
                      m.materialName.toLowerCase().includes(searchLower)
                    );
                    const matchedCatalog = materials.filter(m =>
                      !searchLower ||
                      m.code?.toLowerCase().includes(searchLower) ||
                      m.name?.toLowerCase().includes(searchLower)
                    );
                    const listToDisplay = matchedBoq.length > 0
                      ? matchedBoq.map(m => ({ materialId: m.materialId, code: m.materialCode, name: m.materialName, unitName: m.unitName }))
                      : matchedCatalog.map(m => ({ materialId: m.materialId, code: m.code, name: m.name, unitName: m.baseUnitName }));

                    if (listToDisplay.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-gray-500">
                          Không tìm thấy vật tư phù hợp với từ khóa
                        </div>
                      );
                    }

                    return listToDisplay.map(mat => {
                      const isAlreadyAdded = items.some(x => x.materialId === mat.materialId);
                      return (
                        <div
                          key={mat.materialId}
                          className={`p-2 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isAlreadyAdded
                              ? 'bg-gray-50 opacity-60'
                              : 'hover:bg-blue-50/80 text-gray-800'
                          }`}
                          onClick={() => {
                            setSelectedMaterialId(mat.materialId);
                            setSearchKeyword(`[${mat.code}] ${mat.name}`);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold shrink-0">
                              {mat.code}
                            </span>
                            <span className="text-xs font-medium text-gray-900 truncate">{mat.name}</span>
                            <span className="text-[11px] text-gray-400 shrink-0">({mat.unitName})</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isAlreadyAdded ? (
                              <span className="text-[10px] text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded font-medium">Đã thêm</span>
                            ) : (
                              <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn</span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="mt-3 bg-white rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Mã VT</th>
                    <th className="px-4 py-3 text-left font-medium">Tên vật tư</th>
                    <th className="px-4 py-3 text-center font-medium">Đơn vị</th>
                    <th className="px-4 py-3 text-center font-medium">Số lượng tăng</th>
                    <th className="px-4 py-3 text-center font-medium w-16">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {items.map(it => {
                    const bm = boqMaterials.find(x => x.materialId === it.materialId);
                    const cm = materials.find(x => x.materialId === it.materialId);
                    const code = bm?.materialCode || cm?.code || '';
                    const name = bm?.materialName || cm?.name || '';
                    const unit = bm?.unitName || cm?.baseUnitName || '---';
                    return (
                      <tr key={it.materialId}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{code}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{name}</td>
                        <td className="px-4 py-3 text-center text-gray-600 text-xs">{unit}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600">+{it.quantity}</td>
                        <td className="px-4 py-3 text-center">
                          <button type="button" className="text-red-500 hover:text-red-700 font-medium text-xs hover:underline" onClick={() => handleRemoveItem(it.materialId)}>Xóa</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Hủy</Button>
          <Button type="submit" variant="primary" isLoading={loading}>Tạo Phiếu Tăng</Button>
        </div>
      </form>
    </Modal>
  );
};
