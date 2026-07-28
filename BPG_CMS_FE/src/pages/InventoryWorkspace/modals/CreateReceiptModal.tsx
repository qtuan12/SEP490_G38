import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem, Select } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import type { PurchaseOrderDto, PurchaseOrderItemDto } from '../../../services/inventoryService';
import { UploadCloud, X, AlertCircle, Loader2 } from 'lucide-react';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { isDiscreteUnit } from '../../../utils/unitHelpers';

interface CreateReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
      setUploadedFiles([]);
      setGeneralError(null);
    }
  }, [isOpen]);

  const fetchPOs = async () => {
    setLoadingPOs(true);
    try {
      const data = await inventoryService.getPurchaseOrdersForReceipt(projectId);
      // Filter for active POs (Sent or PartiallyReceived)
      const activePOs = data.filter(
        po => po.status === 'Sent' || po.status === 'PartiallyReceived'
      );
      setPurchaseOrders(activePOs);

      // Auto-select PO if poId is in URL search params
      const searchPOId = new URLSearchParams(window.location.search).get('poId');
      if (searchPOId) {
        const po = activePOs.find(p => p.poId.toString() === searchPOId) || null;
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
    if (!selectedPO) {
      setGeneralError('Vui lòng chọn đơn mua hàng.');
      return;
    }

    setGeneralError(null);

    // Validate all items
    const submitItems = [];
    const itemErrors: Record<number, string> = {};

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
      return;
    }

    if (submitItems.length === 0) {
      setGeneralError('Vui lòng nhập số lượng nhận cho ít nhất một vật tư (lớn hơn 0).');
      return;
    }

    // Custom business validation: Goods Receipt requires at least one photo
    if (uploadedFiles.length === 0) {
      setGeneralError('Biên bản nhận hàng bắt buộc phải có ảnh chụp vật tư thực tế tại công trường.');
      return;
    }

    if (uploadedFiles.some(f => f.status === 'uploading')) {
      setGeneralError('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }

    if (uploadedFiles.some(f => f.status === 'error') || uploadedFiles.some(f => !f.url || !f.url.startsWith('http'))) {
      setGeneralError('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      await inventoryService.createGoodsReceipt({
        poId: selectedPO.poId,
        delivererInfo: delivererInfo.trim() ? `[Kiểm hàng: ${qcNote.trim() || 'Đạt'}] ${delivererInfo.trim()}` : `[Kiểm hàng: ${qcNote.trim() || 'Đạt'}]`,
        deliveryDocNo: deliveryDocNo.trim() || null,
        items: submitItems,
        images: imageUrls
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating goods receipt:', err);
      setGeneralError(err.message || 'Lỗi hệ thống khi tạo phiếu nhập kho.');
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
          <FormItem label="Chọn đơn hàng" required>
            <Select
              options={[
                { label: '-- Chọn đơn hàng --', value: '' },
                ...purchaseOrders.map(po => ({
                  label: `${po.poNumber} (${po.supplierName}) - ${po.status === 'Sent' ? 'Chưa giao' : 'Đã giao một phần'}`,
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
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Chi tiết vật tư trong đơn mua hàng</h4>
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
        <div className="mt-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Ảnh chụp phiếu giao nhận thực tế tại công trường <span className="text-red-500">*</span>
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (uploadedFiles.length < 5 && !submitting) {
                document.getElementById('receipt-image-input')?.click();
              }
            }}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${uploadedFiles.length >= 5
              ? 'border-slate-200 bg-slate-100 cursor-not-allowed opacity-60'
              : dragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
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
            <UploadCloud size={32} className="text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600 mb-0.5">
              Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
            </p>
            <span className="text-xs text-slate-500">
              Đã chọn {uploadedFiles.length}/5 ảnh (Bắt buộc ít nhất 1 ảnh chụp vật tư thực tế)
            </span>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="flex gap-3 mt-3 flex-wrap">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200 group">
                  <div className={`relative w-full h-full rounded overflow-hidden border ${file.status === 'error' ? 'border-red-500' : file.status === 'success' ? 'border-green-500' : 'border-slate-200'}`}>
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />

                    {file.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white" />
                      </div>
                    )}

                    {file.status === 'error' && (
                      <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                    )}

                    {file.status === 'success' && (
                      <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">OK</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity z-10 border-none outline-none cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
