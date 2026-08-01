import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Input, FormItem, ConfirmDialog } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { formatDateVN } from '../../../utils/inventoryHelpers';
import type { GoodsReceiptDetail, GoodsReceiptItemDetail } from '../../../types/inventory';
import {
  Calendar,
  User,
  FileText,
  Tag,
  Loader2,
  Image as ImageIcon,
  X,
  Edit3,
  Trash2,
  Save,
  UploadCloud,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressAndUploadFile } from '../../../utils/uploadHelper';
import type { UploadedFileState } from '../../../utils/uploadHelper';
import { useRealtimeDataRefresh } from '../../../hooks/useRealtimeDataRefresh';
import { RealtimeEntities } from '../../../constants/realtimeEntities';

const GOODS_RECEIPT_REALTIME_ENTITIES = RealtimeEntities.inventory.filter(
  entity => entity === 'GoodsReceipt' || entity === 'GoodsReceiptItem',
);


interface ReceiptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: number | null;
  canManageInventory?: boolean;
  onSuccess?: () => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  isOpen,
  onClose,
  receiptId,
  canManageInventory = false,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GoodsReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;
  const [delivererInfo, setDelivererInfo] = useState('');
  const [deliveryDocNo, setDeliveryDocNo] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);

  // Actions states
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);

  useEffect(() => {
    if (isOpen && receiptId) {
      fetchDetail();
      setActiveImage(null);
      setError(null);
      setActionError(null);
      setIsEditing(false);
      setIsConfirmCancelOpen(false);
    }
  }, [isOpen, receiptId]);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach(p => {
        if (p.url && p.url.startsWith('blob:')) URL.revokeObjectURL(p.url);
      });
    };
  }, [uploadedFiles]);

  const fetchDetail = async (showLoading = true, preserveEditForm = false) => {
    if (!receiptId) return;
    if (showLoading) setLoading(true);
    try {
      const data = await inventoryService.getGoodsReceiptDetail(receiptId);
      setDetail(data);
      setError(null);

      // A realtime request may have started just before the user entered edit mode.
      // Keep the freshly fetched detail, but never replace fields/files being edited.
      if (!preserveEditForm || !isEditingRef.current) {
        setDelivererInfo(data.delivererInfo || '');
        setDeliveryDocNo(data.deliveryDocNo || '');
        setExistingImages(data.images || []);
        setUploadedFiles([]);
      }
    } catch (err: any) {
      console.error('Error fetching receipt detail:', err);
      if (showLoading) setError(err.message || 'Không thể tải chi tiết phiếu nhập kho.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useRealtimeDataRefresh(
    () => {
      if (!isOpen || !receiptId || isEditing) return;
      return fetchDetail(false, true);
    },
    GOODS_RECEIPT_REALTIME_ENTITIES,
  );

  const handleCancelReceipt = async () => {
    if (!receiptId || !detail) return;

    setCancelling(true);
    setActionError(null);
    try {
      await inventoryService.cancelGoodsReceipt(receiptId);
      setIsConfirmCancelOpen(false);
      await fetchDetail();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error cancelling goods receipt:', err);
      setActionError(err.message || 'Lỗi hệ thống khi hủy phiếu nhập kho.');
      setIsConfirmCancelOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!receiptId) return;

    if (uploadedFiles.some(f => f.status === 'uploading')) {
      toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
      return;
    }

    if (uploadedFiles.some(f => f.status === 'error') || uploadedFiles.some(f => !f.url || !f.url.startsWith('http'))) {
      toast.error('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      setActionError('Không thể tải ảnh lên. Vui lòng kiểm tra lại kết nối hoặc dung lượng file.');
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      const uploadedUrls = uploadedFiles
        .filter(f => f.status === 'success' && f.url)
        .map(f => f.url!);

      const finalImages = [...existingImages, ...uploadedUrls];

      await inventoryService.patchGoodsReceiptMetadata(receiptId, {
        receiptId,
        delivererInfo: delivererInfo.trim() || null,
        deliveryDocNo: deliveryDocNo.trim() || null,
        images: finalImages
      });

      setIsEditing(false);
      await fetchDetail();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error updating metadata:', err);
      setActionError(err.message || 'Lỗi hệ thống khi cập nhật thông tin phiếu.');
    } finally {
      setSaving(false);
    }
  };

  // Image editing helpers
  const removeExistingImage = (idxToRemove: number) => {
    setExistingImages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const addFiles = (files: File[]) => {
    const imgFiles = files.filter(f => f.type.startsWith('image/'));
    const maxAllowed = 5 - (existingImages.length + uploadedFiles.length);
    if (maxAllowed <= 0) {
      toast.error('Tổng số ảnh (cũ + mới) không được vượt quá 5.');
      return;
    }

    const toUpload = imgFiles.slice(0, maxAllowed);
    if (!toUpload.length) return;

    toUpload.forEach(file => {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);

      const newFileState: UploadedFileState = {
        id: tempId,
        name: file.name,
        url: localUrl,
        status: 'uploading'
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
          toast.error(`Tải ảnh ${file.name} lên thất bại.`);
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'error' } : f)
          );
        }
      );
    });
  };

  const removeSelectedFile = (id: string) => {
    setUploadedFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target && target.url && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const canCancel = canManageInventory && detail?.status !== 'Cancelled';
  const canEdit = canManageInventory;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => !saving && !cancelling && onClose()}
        title={`Chi tiết Phiếu Nhập Kho: ${detail?.receiptNo || ''}`}
        width="lg"
        footer={
          <div className="flex justify-between items-center w-full">
            <div>
              {!isEditing && canCancel && (
                <Button
                  variant="danger"
                  onClick={() => setIsConfirmCancelOpen(true)}
                  isLoading={cancelling}
                  disabled={loading}
                  className="flex items-center gap-1.5"
                >
                  <Trash2 size={15} />
                  <span>Hủy phiếu</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); fetchDetail(); }} disabled={saving}>
                    Hủy bỏ
                  </Button>
                  <Button variant="primary" onClick={handleSaveMetadata} isLoading={saving} className="flex items-center gap-1.5">
                    <Save size={15} />
                    <span>Lưu thay đổi</span>
                  </Button>
                </>
              ) : (
                <>
                  {detail?.status !== 'Cancelled' && canEdit && (
                    <Button variant="outline" onClick={() => setIsEditing(true)} disabled={loading} className="flex items-center gap-1.5">
                      <Edit3 size={15} />
                      <span>Sửa thông tin</span>
                    </Button>
                  )}
                  <Button variant="outline" onClick={onClose} disabled={loading}>
                    Đóng
                  </Button>
                </>
              )}
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="flex justify-center items-center py-12 gap-3">
            <Loader2 className="animate-spin text-blue-600" size={24} />
            <span className="text-slate-500 text-sm">Đang tải thông tin chi tiết...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-700 text-sm border border-red-200 rounded">
            {error}
          </div>
        ) : detail ? (
          <div className="flex flex-col gap-5 text-sm text-left">

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Status Bar */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-slate-500 font-medium">Trạng thái phiếu:</span>
              {detail.status === 'Cancelled' ? (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 uppercase tracking-wide">
                  Đã hủy (Reversed)
                </span>
              ) : (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
                  Đã nhập kho
                </span>
              )}
            </div>

            {/* Metadata Cards */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2.5 text-slate-600 justify-center">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="font-medium">Mã đơn hàng:</span>
                        <span className="text-slate-900 font-semibold">{detail.poNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-slate-400" />
                        <span className="font-medium">Nhà cung cấp:</span>
                        <span className="text-slate-900 font-semibold">{detail.supplierName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5 text-slate-600 justify-center">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="font-medium">Ngày nhận hàng:</span>
                        <span className="text-slate-900">{formatDateVN(detail.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-slate-400" />
                        <span className="font-medium">Người tiếp nhận:</span>
                        <span className="text-slate-900">{detail.createdByName}</span>
                      </div>
                    </div>
                  </div>

                  <hr className="my-2 border-slate-200" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormItem label="Thông tin người giao" required>
                      <Input
                        value={delivererInfo}
                        onChange={e => setDelivererInfo(e.target.value)}
                        placeholder="Tên người giao, SĐT..."
                      />
                    </FormItem>
                    <FormItem label="Mã phiếu giao hàng">
                      <Input
                        value={deliveryDocNo}
                        onChange={e => setDeliveryDocNo(e.target.value)}
                        placeholder="Ví dụ: GD-12345"
                      />
                    </FormItem>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <FileText size={16} className="text-slate-400" />
                      <span className="font-medium">Mã đơn hàng:</span>
                      <span className="text-slate-900 font-semibold">{detail.poNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Tag size={16} className="text-slate-400" />
                      <span className="font-medium">Nhà cung cấp:</span>
                      <span className="text-slate-900 font-semibold">{detail.supplierName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar size={16} className="text-slate-400" />
                      <span className="font-medium">Ngày nhận hàng:</span>
                      <span className="text-slate-900">{formatDateVN(detail.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2 text-slate-600">
                      <User size={16} className="text-slate-400" />
                      <span className="font-medium">Người giao hàng:</span>
                      <span className="text-slate-900">
                        {(() => {
                          const info = detail.delivererInfo || 'Chưa cập nhật';
                          const match = info.match(/^\[(?:QC|Kiểm hàng):\s*([^\]]+)\](.*)$/);
                          if (match) {
                            return match[2].trim() || 'Chưa cập nhật';
                          }
                          return info;
                        })()}
                      </span>
                    </div>
                    {(() => {
                      const info = detail.delivererInfo || '';
                      const match = info.match(/^\[(?:QC|Kiểm hàng):\s*([^\]]+)\](.*)$/);
                      if (match) {
                        const status = match[1];
                        let badgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                        if (status.includes("Đạt")) badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        else if (status.includes("Không")) badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                        else if (status.includes("Chờ")) badgeClass = "bg-amber-50 text-amber-700 border-amber-200";

                        return (
                          <div className="flex items-center gap-2 text-slate-600">
                            <FileText size={16} className="text-slate-400" />
                            <span className="font-medium">Ghi chú:</span>
                            <span className={`inline-flex text-xs font-semibold ${badgeClass}`}>
                              {status}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex items-center gap-2 text-slate-600">
                      <FileText size={16} className="text-slate-400" />
                      <span className="font-medium">Số phiếu Nhà cung cấp:</span>
                      <span className="text-slate-900 font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{detail.deliveryDocNo || 'Chưa cập nhật'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <User size={16} className="text-slate-400" />
                      <span className="font-medium">Người tiếp nhận:</span>
                      <span className="text-slate-900">{detail.createdByName}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Danh sách vật tư thực nhận</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="px-4 py-2.5">Mã vật tư</th>
                      <th className="px-4 py-2.5">Tên vật tư</th>
                      <th className="px-4 py-2.5">Quy cách</th>
                      <th className="px-4 py-2.5 text-right">Số lượng nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {detail.items.map((item: GoodsReceiptItemDetail) => (
                      <tr key={item.receiptItemId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {item.materialCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {item.materialName}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {item.specification || 'Chưa cập nhật'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950">
                          {item.quantity} <span className="text-xs text-slate-500 font-normal">{item.unitName}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Evidence images */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <ImageIcon size={16} className="text-slate-500" />
                <span>Ảnh chụp chứng từ giao nhận</span>
              </h4>

              {isEditing ? (
                <div className="flex flex-col gap-3">
                  {/* Existing Images */}
                  {existingImages.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                      {existingImages.map((imgUrl, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200">
                          <img src={imgUrl} alt="evidence" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload New Section */}
                  {existingImages.length + uploadedFiles.length < 5 && (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragging(true); }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setDragging(false);
                        if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
                      }}
                      onClick={() => document.getElementById('edit-receipt-image-input')?.click()}
                      className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                        }`}
                    >
                      <input
                        id="edit-receipt-image-input"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
                      />
                      <UploadCloud size={24} className="text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-medium text-slate-600 mb-0.5">
                        Kéo thả hoặc click để thêm ảnh mới
                      </p>
                      <span className="text-[10px] text-slate-500">
                        Tổng số ảnh tối đa là 5 (hiện tại còn được chọn thêm {5 - (existingImages.length + uploadedFiles.length)} ảnh)
                      </span>
                    </div>
                  )}

                  {/* Selected Files Preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                      {uploadedFiles.map((file) => (
                        <div key={file.id} className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200">
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
                            onClick={() => removeSelectedFile(file.id)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity z-10 border-none outline-none cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                detail.images && detail.images.length > 0 ? (
                  <div className="flex gap-3 flex-wrap">
                    {detail.images.map((imgUrl: string, idx: number) => (
                      <div
                        key={idx}
                        onClick={() => setActiveImage(imgUrl)}
                        className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                      >
                        <img src={imgUrl} alt="evidence" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-xs">Không có ảnh chứng từ đính kèm.</span>
                )
              )}
            </div>

            {/* Image Lightbox Modal */}
            {activeImage && (
              <div
                className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[9999]"
                onClick={() => setActiveImage(null)}
              >
                <div className="relative max-w-3xl max-h-[80vh] p-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveImage(null)}
                    className="absolute -top-10 right-0 bg-white text-slate-950 rounded-full p-2 hover:bg-slate-200 transition-colors"
                  >
                    <X size={20} />
                  </button>
                  <img
                    src={activeImage}
                    alt="expanded evidence"
                    className="max-w-full max-h-[75vh] rounded-lg shadow-2xl object-contain bg-white"
                  />
                </div>
              </div>
            )}

          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmCancelOpen}
        onClose={() => setIsConfirmCancelOpen(false)}
        onConfirm={handleCancelReceipt}
        title="Hủy Phiếu Nhập Kho"
        message={`Bạn có chắc chắn muốn HỦY phiếu nhập kho ${detail?.receiptNo || ''}? Hệ thống sẽ tự động trừ số lượng vật tư này khỏi kho thực tế dự án và cập nhật lại số lượng nhận trên đơn hàng. Hành động này không thể hoàn tác.`}
        confirmText="Xác nhận hủy"
        cancelText="Đóng"
        isDanger={true}
        isLoading={cancelling}
      />
    </>
  );
};
