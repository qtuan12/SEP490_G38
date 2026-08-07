import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem, Select } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import type { PurchaseOrderDto, PurchaseOrderItemDto } from '../../../services/inventoryService';
import { UploadCloud, X, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { isDiscreteUnit } from '../../../utils/unitHelpers';
import { getPOStatusLabel } from '../../../utils/inventoryHelpers';

interface CreateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  projectId: number;
}

export const CreateReceiptModal: React.FC<CreateReceiptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projectId
}) => {
  const [loadingPOs, setLoadingPOs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderDto | null>(null);

  // Form fields
  const [delivererInfo, setDelivererInfo] = useState('');
  const [deliveryDocNo, setDeliveryDocNo] = useState('');
  const [qcNote, setQcNote] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({}); // materialId -> qty string
  const [errors, setErrors] = useState<Record<number, string>>({}); // materialId -> error message

  // Field-specific error states
  const [poError, setPoError] = useState<string | null>(null);
  const [qtyTableError, setQtyTableError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Files upload
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPOs();
      // Reset form
      setSelectedPOId('');
      setSelectedPO(null);
      setDelivererInfo('');
      setDeliveryDocNo('');
      setQcNote('');
      setQuantities({});
      setErrors({});
      setPoError(null);
      setQtyTableError(null);
      setImageError(null);
      setUploadedFiles([]);
      setGeneralError(null);
    }
  }, [isOpen]);

  // Auto clear imageError when all uploaded files finish uploading successfully
  useEffect(() => {
    if (uploadedFiles.length > 0 && !uploadedFiles.some(f => f.status === 'uploading')) {
      if (uploadedFiles.every(f => f.status === 'success' && f.url && f.url.startsWith('http'))) {
        setImageError(null);
      }
    }
  }, [uploadedFiles]);

  const fetchPOs = async () => {
    setLoadingPOs(true);
    try {
      const data = await inventoryService.getPurchaseOrdersForReceipt(projectId);
      const searchPOId = new URLSearchParams(window.location.search).get('poId');
      // Filter for active POs (Sent or PartiallyReceived) or explicitly target PO from search params
      const activePOs = data.filter(
        po => po.status === 'Sent' || po.status === 'PartiallyReceived' || (searchPOId && po.poId.toString() === searchPOId)
      );
      setPurchaseOrders(activePOs);

      // Auto-select PO if poId is in URL search params
      if (searchPOId) {
        const po = data.find(p => p.poId.toString() === searchPOId) || null;
        if (po) {
          setSelectedPOId(searchPOId);
          setSelectedPO(po);

          const initialQtys: Record<number, string> = {};
          po.items.forEach(item => {
            const remaining = item.quantity - item.totalReceived;
            initialQtys[item.materialId] = remaining > 0 ? remaining.toString() : '0';
          });
          setQuantities(initialQtys);
        }
      }
    } catch (err: any) {
      console.error('Error fetching POs:', err);
      setGeneralError('Không thể tải danh sách đơn mua hàng.');
    } finally {
      setLoadingPOs(false);
    }
  };

  const handlePOChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const poIdStr = e.target.value;
    setSelectedPOId(poIdStr);
    setPoError(null);
    setQtyTableError(null);

    if (!poIdStr) {
      setSelectedPO(null);
      setQuantities({});
      setErrors({});
      return;
    }

    const po = purchaseOrders.find(p => p.poId.toString() === poIdStr) || null;
    setSelectedPO(po);

    if (po) {
      const initialQtys: Record<number, string> = {};
      po.items.forEach(item => {
        const remaining = item.quantity - item.totalReceived;
        initialQtys[item.materialId] = remaining > 0 ? remaining.toString() : '0';
      });
      setQuantities(initialQtys);
      setErrors({});
    }
  };

  const handleQuantityChange = (materialId: number, value: string, item: PurchaseOrderItemDto) => {
    setQuantities(prev => ({ ...prev, [materialId]: value }));
    setQtyTableError(null);

    const numVal = parseFloat(value);
    const remaining = item.quantity - item.totalReceived;

    if (isNaN(numVal)) {
      setErrors(prev => ({ ...prev, [materialId]: 'Vui lòng nhập số lượng hợp lệ.' }));
    } else if (numVal <= 0) {
      setErrors(prev => ({ ...prev, [materialId]: 'Số lượng nhận phải lớn hơn 0.' }));
    } else if (numVal > remaining) {
      setErrors(prev => ({
        ...prev,
        [materialId]: `Không được vượt quá số lượng còn lại của đơn hàng (${remaining} ${item.unitName}).`
      }));
    } else if (isDiscreteUnit(item.unitName) && numVal % 1 !== 0) {
      setErrors(prev => ({
        ...prev,
        [materialId]: `Đơn vị "${item.unitName}" yêu cầu số lượng phải là số nguyên.`
      }));
    } else {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[materialId];
        return copy;
      });
    }
  };

  // Image upload handlers
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
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validImages = files.filter(file => file.type.startsWith('image/'));
    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) {
      return;
    }
    const toUpload = validImages.slice(0, remaining);
    if (!toUpload.length) return;

    toUpload.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading',
        file
      };

      setUploadedFiles(prev => [...prev, newFileState]);

      compressAndUploadFile(
        file,
        'goodsreceipts',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };

  const retryUpload = (id: string) => {
    const target = uploadedFiles.find(f => f.id === id);
    if (!target || !target.file) return;

    setUploadedFiles(prev =>
      prev.map(f => f.id === id ? { ...f, status: 'uploading' } : f)
    );

    compressAndUploadFile(
      target.file,
      'goodsreceipts',
      (uploadedUrl) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'success', url: uploadedUrl } : f)
        );
      },
      () => {
        toast.error(`Không thể tải ảnh ${target.name} lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.`);
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'error' } : f)
        );
      }
    );
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setPoError(null);
    setQtyTableError(null);
    setImageError(null);

    let hasFieldError = false;

    if (!selectedPO) {
      setPoError('Vui lòng chọn đơn mua hàng.');
      hasFieldError = true;
    }

    // Validate all items
    const submitItems = [];
    const itemErrors: Record<number, string> = {};

    if (selectedPO) {
      for (const item of selectedPO.items) {
        const qtyStr = quantities[item.materialId] || '0';
        const numVal = parseFloat(qtyStr);
        const remaining = item.quantity - item.totalReceived;

        if (isNaN(numVal) || numVal < 0) {
          itemErrors[item.materialId] = 'Số lượng không hợp lệ.';
        } else if (numVal > remaining) {
          itemErrors[item.materialId] = `Vượt quá giới hạn còn lại (${remaining}).`;
        } else if (isDiscreteUnit(item.unitName) && numVal % 1 !== 0) {
          itemErrors[item.materialId] = `Đơn vị "${item.unitName}" yêu cầu số lượng phải là số nguyên.`;
        } else if (numVal > 0) {
          submitItems.push({
            materialId: item.materialId,
            unitId: item.unitId,
            quantity: numVal
          });
        }
      }

      if (Object.keys(itemErrors).length > 0) {
        setErrors(itemErrors);
        hasFieldError = true;
      }

      if (submitItems.length === 0 && Object.keys(itemErrors).length === 0) {
        setQtyTableError('Vui lòng nhập số lượng nhận cho ít nhất một vật tư (lớn hơn 0).');
        hasFieldError = true;
      }
    }

    // Custom business validation: Goods Receipt requires at least one photo
    if (uploadedFiles.length === 0) {
      setImageError('Biên bản nhận hàng bắt buộc phải có ảnh chụp vật tư thực tế tại công trường.');
      hasFieldError = true;
    } else if (uploadedFiles.some(f => f.status === 'uploading')) {
      setImageError('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      hasFieldError = true;
    } else if (uploadedFiles.some(f => f.status === 'error') || uploadedFiles.some(f => !f.url || !f.url.startsWith('http'))) {
      setImageError('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      hasFieldError = true;
    }

    if (hasFieldError || !selectedPO) {
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      const result = await inventoryService.createGoodsReceipt({
        poId: selectedPO.poId,
        delivererInfo: delivererInfo.trim() ? `[Kiểm hàng: ${qcNote.trim() || 'Đạt'}] ${delivererInfo.trim()}` : `[Kiểm hàng: ${qcNote.trim() || 'Đạt'}]`,
        deliveryDocNo: deliveryDocNo.trim() || null,
        items: submitItems,
        images: imageUrls
      });

      onSuccess(result.message);
      onClose();
    } catch (err: any) {
      console.error('Error creating goods receipt:', err);
      setGeneralError(err.message || 'Không thể tạo phiếu nhập kho.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title="Tạo Phiếu Nhập Kho"
      width="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={submitting}
            disabled={loadingPOs || !selectedPOId || Object.keys(errors).length > 0}
          >
            Xác nhận Nhập kho
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormItem label="Chọn đơn hàng" required error={poError || undefined}>
            <Select
              options={[
                { label: '-- Chọn đơn hàng --', value: '' },
                ...purchaseOrders.map(po => ({
                  label: `${po.poNumber} (${po.supplierName}) - ${getPOStatusLabel(po.status)}`,
                  value: po.poId.toString()
                }))
              ]}
              value={selectedPOId}
              onChange={handlePOChange}
              disabled={loadingPOs || submitting}
            />
          </FormItem>

          <FormItem label="Ghi chú chất lượng kiểm hàng">
            <Input
              value={qcNote}
              onChange={e => setQcNote(e.target.value)}
              placeholder="Ví dụ: Cát sạch đạt yêu cầu, trả lại 2 cây thép rỉ..."
              disabled={submitting}
            />
          </FormItem>

          <FormItem label="Số phiếu giao hàng (Nhà cung cấp)">
            <Input
              value={deliveryDocNo}
              onChange={e => setDeliveryDocNo(e.target.value)}
              placeholder="Ví dụ: GD-98212"
              disabled={submitting}
            />
          </FormItem>

          <FormItem label="Thông tin người giao">
            <Input
              value={delivererInfo}
              onChange={e => setDelivererInfo(e.target.value)}
              placeholder="Họ tên người giao, số điện thoại..."
              disabled={submitting}
            />
          </FormItem>
        </div>

        {selectedPO && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h4 className="text-sm font-semibold text-slate-700">Chi tiết vật tư trong đơn mua hàng</h4>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                Trạng thái: <strong className="text-blue-700">{getPOStatusLabel(selectedPO.status)}</strong>
              </span>
            </div>
            {qtyTableError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-red-600 text-xs font-medium flex items-center gap-1.5 mb-2 animate-fade-in">
                <AlertCircle size={14} className="shrink-0" />
                <span>{qtyTableError}</span>
              </div>
            )}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Vật tư</th>
                    <th className="px-4 py-3">Quy cách</th>
                    <th className="px-4 py-3 text-center">Đã nhận / Đặt</th>
                    <th className="px-4 py-3 text-right w-40">Thực nhận đợt này</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {selectedPO.items.map(item => {
                    const remaining = item.quantity - item.totalReceived;
                    const error = errors[item.materialId];
                    return (
                      <tr key={item.poItemId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.materialName}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {item.specification || 'Chưa cập nhật'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          <span className="font-semibold text-blue-600">{item.totalReceived}</span>
                          <span className="text-slate-400"> / {item.quantity}</span>{' '}
                          <span className="text-xs text-slate-500">({item.unitName})</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Input
                              type="number"
                              step={isDiscreteUnit(item.unitName) ? "1" : "any"}
                              value={quantities[item.materialId] ?? ''}
                              onChange={e => handleQuantityChange(item.materialId, e.target.value, item)}
                              disabled={remaining <= 0 || submitting}
                              placeholder="0"
                              className={`text-right w-36 ${error ? 'border-red-500 focus:ring-red-200' : ''}`}
                            />
                            {error && (
                              <span className="text-[10px] text-red-500 font-medium max-w-[150px] text-right">
                                {error}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Evidence Images */}
        <FormItem
          label="Ảnh chụp phiếu giao nhận thực tế tại công trường"
          required
          error={imageError || undefined}
          className="mt-2"
        >
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (uploadedFiles.length < 5 && !submitting) {
                document.getElementById('receipt-image-input')?.click();
              }
            }}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
              imageError
                ? 'border-red-500 bg-red-500/10'
                : uploadedFiles.length >= 5
                  ? 'border-[hsl(var(--border))] bg-[hsl(var(--bg-main))] cursor-not-allowed opacity-60'
                  : dragging
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary-glow))]'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--bg-main))/0.4] hover:bg-[hsl(var(--bg-main))]'
            }`}
          >
            <input
              id="receipt-image-input"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploadedFiles.length >= 5 || submitting}
            />
            <UploadCloud size={28} className="text-[hsl(var(--text-muted))] mx-auto mb-1.5" />

            {uploadedFiles && uploadedFiles.length > 0 ? (
              <div>
                <div
                  className="flex flex-wrap items-center justify-center gap-3 my-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex flex-col items-center gap-1 group relative">
                      <div className={`relative w-16 h-16 rounded overflow-hidden shadow-sm border ${
                        file.status === 'error' ? 'border-red-500' : file.status === 'success' ? 'border-emerald-500' : 'border-[hsl(var(--border))]'
                      }`}>
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover" />

                        {file.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-white" />
                          </div>
                        )}

                        {file.status === 'error' && (
                          <>
                            <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                retryUpload(file.id);
                              }}
                              className="absolute top-1 left-1 bg-blue-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                              title="Thử lại upload"
                            >
                              <RotateCcw size={10} />
                            </button>
                          </>
                        )}

                        {file.status === 'success' && (
                          <span className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-white text-[8px] text-center py-0.5 font-bold">OK</span>
                        )}
                      </div>

                      <span className="text-[10px] text-[hsl(var(--text-secondary))] truncate w-16 text-center" title={file.name}>
                        {file.name}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-80 group-hover:opacity-100 transition-opacity z-10 border-none outline-none cursor-pointer"
                        title="Xóa ảnh"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {uploadedFiles.length < 5 && (
                  <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                    Click vào khoảng trống hoặc kéo thả để thêm ảnh ({uploadedFiles.length}/5)
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-0.5">
                  Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
                </p>
                <span className="text-xs text-[hsl(var(--text-muted))]">
                  Hỗ trợ PNG, JPG, JPEG tối đa 5 ảnh (Bắt buộc ít nhất 1 ảnh chụp vật tư thực tế)
                </span>
              </div>
            )}
          </div>
        </FormItem>
      </form>
    </Modal>
  );
};
