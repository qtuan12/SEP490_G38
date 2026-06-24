import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, FormItem } from '../../../components/ui';
import { inventoryService } from '../../../services/inventoryService';
import { projectService } from '../../../services/projectService';
import type { GoodsReceiptDetail, GoodsReceiptItemDetail } from '../../../types/inventory';
import { useAuth } from '../../../context/AuthContext';
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

interface ReceiptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: number | null;
  onSuccess?: () => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  isOpen,
  onClose,
  receiptId,
  onSuccess
}) => {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<GoodsReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [delivererInfo, setDelivererInfo] = useState('');
  const [deliveryDocNo, setDeliveryDocNo] = useState('');
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  // Actions states
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && receiptId) {
      fetchDetail();
      setActiveImage(null);
      setError(null);
      setActionError(null);
      setIsEditing(false);
    }
  }, [isOpen, receiptId]);

  const fetchDetail = async () => {
    if (!receiptId) return;
    setLoading(true);
    try {
      const data = await inventoryService.getGoodsReceiptDetail(receiptId);
      setDetail(data);

      // Initialize edit fields
      setDelivererInfo(data.delivererInfo || '');
      setDeliveryDocNo(data.deliveryDocNo || '');
      setExistingImages(data.images || []);
      setSelectedFiles([]);
    } catch (err: any) {
      console.error('Error fetching receipt detail:', err);
      setError(err.message || 'Không thể tải chi tiết phiếu nhập kho.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReceipt = async () => {
    if (!receiptId || !detail) return;
    
    const confirmCancel = window.confirm(
      `Bạn có chắc chắn muốn HỦY phiếu nhập kho ${detail.receiptNo}?\n\n` +
      `Lưu ý: Hệ thống sẽ tự động trừ số lượng vật tư này khỏi kho thực tế dự án và cập nhật lại số lượng nhận trên PO. Hành động này không thể hoàn tác.`
    );
    if (!confirmCancel) return;

    setCancelling(true);
    setActionError(null);
    try {
      await inventoryService.cancelGoodsReceipt(receiptId);
      await fetchDetail();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error cancelling goods receipt:', err);
      setActionError(err.message || 'Lỗi hệ thống khi hủy phiếu nhập kho.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!receiptId) return;

    setSaving(true);
    setActionError(null);
    try {
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        uploadedUrls = await projectService.uploadFiles(selectedFiles, 'goodsreceipts');
      }

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
    setSelectedFiles(prev => {
      const merged = [...prev, ...imgFiles];
      const maxAllowed = 5 - existingImages.length;
      return merged.slice(0, Math.max(0, maxAllowed));
    });
  };

  const removeSelectedFile = (idxToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Check role for Cancel permission (Manager roles and Admin)
  const isManagerOrAdmin = currentUser && ['admin', 'technicalmanager', 'accountant', 'director'].includes(currentUser.role.toLowerCase());
  const canCancel = isManagerOrAdmin && detail?.status !== 'Cancelled';

  return (
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
                onClick={handleCancelReceipt}
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
                {detail?.status !== 'Cancelled' && (
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
                      <span className="font-medium">Mã đơn hàng PO:</span>
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
                      <span className="text-slate-900">{new Date(detail.createdAt).toLocaleDateString('vi-VN')}</span>
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
                  <FormItem label="Số phiếu giao hàng (NCC)">
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
                    <span className="font-medium">Mã đơn hàng PO:</span>
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
                    <span className="text-slate-900">{new Date(detail.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-slate-600">
                    <User size={16} className="text-slate-400" />
                    <span className="font-medium">Người giao hàng:</span>
                    <span className="text-slate-900">{detail.delivererInfo || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <FileText size={16} className="text-slate-400" />
                    <span className="font-medium">Số phiếu NCC:</span>
                    <span className="text-slate-900 font-mono bg-slate-200 px-1.5 py-0.5 rounded text-xs">{detail.deliveryDocNo || 'N/A'}</span>
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
                        {item.specification || 'N/A'}
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
                {existingImages.length < 5 && (
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragging(false);
                      if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
                    }}
                    onClick={() => document.getElementById('edit-receipt-image-input')?.click()}
                    className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
                      dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
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
                      Tổng số ảnh tối đa là 5 (hiện tại còn được chọn thêm {5 - existingImages.length} ảnh)
                    </span>
                  </div>
                )}

                {/* Selected Files Preview */}
                {selectedFiles.length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    {selectedFiles.map((file, idx) => {
                      const previewUrl = URL.createObjectURL(file);
                      return (
                        <div key={idx} className="relative w-20 h-20 rounded-md overflow-hidden border border-slate-200">
                          <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-80 hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
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
  );
};
