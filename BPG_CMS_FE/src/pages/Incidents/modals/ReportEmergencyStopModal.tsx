import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { UploadCloud, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressAndUploadFile, type UploadedFileState } from '../../../utils/uploadHelper';
import { LazyImage } from '../../../utils/imageOptimizer';


interface ReportEmergencyStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  onSuccess: (msg: string) => void;
}

const getLocalISOString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const formatDisplayDateTime = (isoString: string) => {
  if (!isoString) return '';
  if (isoString.includes('T')) {
    const [d, t] = isoString.split('T');
    const [yyyy, mm, dd] = d.split('-');
    return `${t} ngày ${dd}/${mm}/${yyyy}`;
  }
  return isoString;
};

export const ReportEmergencyStopModal: React.FC<ReportEmergencyStopModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = '',
  onSuccess,
}) => {
  const [soBienBan, setSoBienBan] = useState(() => `BB-INC-${Date.now().toString().slice(-6)}`);

  const [hangMuc, setHangMuc] = useState('');
  const [thoiGianXayRa, setThoiGianXayRa] = useState(getLocalISOString);
  const [diaDiem, setDiaDiem] = useState('');
  const [loaiSuCo, setLoaiSuCo] = useState('Sự cố ngừng thi công khẩn cấp');
  const [mucDo, setMucDo] = useState('Khẩn cấp');

  const [moTaSuCo, setMoTaSuCo] = useState('');
  const [thietHaiConNguoi, setThietHaiConNguoi] = useState('Không có');
  const [thietHaiTienDo, setThietHaiTienDo] = useState('Tạm dừng thi công toàn dự án');

  const [thietHaiTaiSanText, setThietHaiTaiSanText] = useState('');

  const [nguyenNhanBanDau, setNguyenNhanBanDau] = useState('');
  const [bienPhapKhanCap, setBienPhapKhanCap] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileState[]>([]);
  const [dragging, setDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let finalDescJson: any = {
        soBienBan: soBienBan.trim(),

        congTrinh: projectName.trim(),
        hangMuc: hangMuc.trim(),
        thoiGianXayRa: formatDisplayDateTime(thoiGianXayRa.trim()),
        diaDiem: diaDiem.trim(),
        loaiSuCo: loaiSuCo.trim(),
        mucDo,
        moTaSuCo: moTaSuCo.trim(),
        thietHaiConNguoi: thietHaiConNguoi.trim(),
        thietHaiTaiSan: thietHaiTaiSanText.trim(),
        thietHaiTienDo: thietHaiTienDo.trim(),
        nguyenNhanBanDau: nguyenNhanBanDau.trim(),
        bienPhapKhanCap: bienPhapKhanCap.trim(),
        imageUrls: []
      };

      if (uploadedFiles.some(f => f.status === 'uploading')) {
        toast.error('Vui lòng chờ hình ảnh tải lên hoàn tất.');
        throw new Error('Hình ảnh đang tải lên.');
      }
      if (uploadedFiles.some(f => f.status === 'error')) {
        toast.error('Có hình ảnh tải lên bị lỗi. Vui lòng xóa ảnh lỗi hoặc thử lại.');
        throw new Error('Có ảnh tải lên bị lỗi.');
      }

      finalDescJson.imageUrls = uploadedFiles.map(f => f.url!).filter(Boolean);

      await incidentService.createAndAssessIncident({
        projectId: Number(projectId),
        incidentType: 'Construction',
        description: JSON.stringify(finalDescJson),
        isEmergency: true,
        damageDescription: thietHaiTaiSanText.trim(),
        estimatedMaterialLoss: undefined,
        estimatedLaborDays: 0,
        estimatedDelayDays: 0,
      });
    },
    onSuccess: () => {
      onSuccess('Biên bản báo cáo sự cố khẩn cấp đã được gửi thành công lên TPKT.');
      setSoBienBan(`BB-INC-${Date.now().toString().slice(-6)}`);
      setHangMuc('');
      setThoiGianXayRa(getLocalISOString());
      setDiaDiem('');
      setMoTaSuCo('');
      setThietHaiConNguoi('Không có');
      setThietHaiTaiSanText('');
      setThietHaiTienDo('Tạm dừng thi công toàn dự án');
      setNguyenNhanBanDau('');
      setBienPhapKhanCap('');
      setUploadedFiles([]);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi gửi yêu cầu.');
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImages(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImages(Array.from(e.target.files));
    }
  };

  const addImages = (files: File[]) => {
    const remaining = 5 - uploadedFiles.length;
    if (remaining <= 0) {
      toast.error('Đã đạt giới hạn tối đa 5 ảnh.');
      return;
    }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;

    valid.forEach(file => {
      const tempId = Math.random().toString(36).substring(2, 9);
      const previewUrl = URL.createObjectURL(file);

      setUploadedFiles(prev => [
        ...prev,
        { id: tempId, name: file.name, url: previewUrl, status: 'uploading', file }
      ]);

      compressAndUploadFile(
        file,
        'incidents',
        (uploadedUrl) => {
          setUploadedFiles(prev =>
            prev.map(f => f.id === tempId ? { ...f, status: 'success', url: uploadedUrl } : f)
          );
        },
        () => {
          toast.error(`Không thể tải ảnh ${file.name} lên.`);
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
      'incidents',
      (uploadedUrl) => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'success', url: uploadedUrl } : f)
        );
      },
      () => {
        toast.error(`Không thể tải ảnh ${target.name} lên.`);
        setUploadedFiles(prev =>
          prev.map(f => f.id === id ? { ...f, status: 'error' } : f)
        );
      }
    );
  };

  const removeImage = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = () => {
    if (!hangMuc.trim()) {
      toast.error('Vui lòng nhập tên hạng mục.');
      return;
    }
    if (!thoiGianXayRa.trim()) {
      toast.error('Vui lòng nhập thời gian xảy ra sự cố.');
      return;
    }
    if (!diaDiem.trim()) {
      toast.error('Vui lòng nhập địa điểm xảy ra sự cố.');
      return;
    }
    if (!moTaSuCo.trim()) {
      toast.error('Vui lòng nhập mô tả sự cố.');
      return;
    }
    if (!thietHaiTaiSanText.trim()) {
      toast.error('Vui lòng nhập mô tả thiệt hại về tài sản/vật tư.');
      return;
    }
    if (!nguyenNhanBanDau.trim()) {
      toast.error('Vui lòng nhập nguyên nhân ban đầu.');
      return;
    }
    if (!bienPhapKhanCap.trim()) {
      toast.error('Vui lòng nhập các biện pháp khẩn cấp đã thực hiện.');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🛑 Biên bản Báo cáo Sự cố Công trình & Yêu cầu dừng" width="xl" maxWidth="950px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'hsl(0, 100%, 97%)',
          border: '1px solid hsl(0, 80%, 75%)',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(0, 92%, 50%)' }}>
            BIÊN BẢN BÁO CÁO SỰ CỐ CÔNG TRÌNH KHẨN CẤP
          </div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
            Lập báo cáo chính thức gửi lên Trưởng phòng Kỹ thuật thẩm định phương án dừng thi công & khắc phục.
          </div>
        </div>

        {/* Scrollable Form Container */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>


          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px' }}>
            I. THÔNG TIN CHUNG
          </div>

          <FormItem label="Dự án">
            <input
              type="text"
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-slate-100 cursor-not-allowed"
              value={projectName}
            />
          </FormItem>

          <FormItem label="Hạng mục thi công (*)" required>
            <input
              type="text"
              className="w-full px-3 py-2 border rounded-lg"
              value={hangMuc}
              onChange={(e) => setHangMuc(e.target.value)}
              placeholder="VD: Phần móng, Tường bao tầng 2,..."
            />
          </FormItem>

          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px', marginTop: '6px' }}>
            II. THÔNG TIN SỰ CỐ
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormItem label="Thời gian xảy ra (*)" required>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 border rounded-lg"
                value={thoiGianXayRa}
                onChange={(e) => setThoiGianXayRa(e.target.value)}
                max={getLocalISOString()}
              />
            </FormItem>

            <FormItem label="Mức độ sự cố (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={mucDo}
                onChange={(e) => setMucDo(e.target.value)}

                defaultValue="Khẩn cấp"
                readOnly
              />
            </FormItem>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormItem label="Địa điểm xảy ra (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={diaDiem}
                onChange={(e) => setDiaDiem(e.target.value)}
                placeholder="VD: Khu vực tháp A, Phân khu B"
              />
            </FormItem>
            <FormItem label="Loại sự cố (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={loaiSuCo}
                onChange={(e) => setLoaiSuCo(e.target.value)}
                placeholder="Loại sự cố"
              />
            </FormItem>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px', marginTop: '6px' }}>
            III. MÔ TẢ & THIỆT HẠI SỰ CỐ
          </div>

          <FormItem label="Mô tả chi tiết diễn biến sự cố (*)" required>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              value={moTaSuCo}
              onChange={(e) => setMoTaSuCo(e.target.value)}
              placeholder="Mô tả cụ thể diễn biến sự cố..."
            />
          </FormItem>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormItem label="Thiệt hại về con người (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={thietHaiConNguoi}
                onChange={(e) => setThietHaiConNguoi(e.target.value)}
                placeholder="VD: Không có thiệt hại"
              />
            </FormItem>
            <FormItem label="Thiệt hại tiến độ (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={thietHaiTienDo}
                onChange={(e) => setThietHaiTienDo(e.target.value)}
                placeholder="VD: Trễ dự kiến 15 ngày..."
              />
            </FormItem>
          </div>

          <div style={{ marginTop: '10px', marginBottom: '14px' }}>
            <FormItem
              label={
                <span>
                  Thiệt hại tài sản/vật tư <span className="text-red-500 font-bold" style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginLeft: '2px' }}>*</span>
                </span>
              }
              required={false}
            >
              <textarea
                className="w-full px-3 py-2 border rounded-lg"
                style={{ minHeight: '120px', fontSize: '0.85rem' }}
                value={thietHaiTaiSanText}
                onChange={(e) => setThietHaiTaiSanText(e.target.value)}
                placeholder="VD: Hỏng 5 máy khoan cầm tay, vỡ 2 tấm kính cường lực..."
              />
            </FormItem>
          </div>

          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'hsl(var(--text-primary))', borderBottom: '1px solid hsl(var(--border))', paddingBottom: '4px', marginTop: '6px' }}>
            IV. NGUYÊN NHÂN & BIỆN PHÁP KHẨN CẤP
          </div>

          <FormItem label="Nguyên nhân ban đầu (*)" required>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              value={nguyenNhanBanDau}
              onChange={(e) => setNguyenNhanBanDau(e.target.value)}
              placeholder="VD: Do mưa lớn kéo dài làm sạt lở bờ móng..."
            />
          </FormItem>

          <FormItem label="Biện pháp khẩn cấp đã thực hiện (*)" required>
            <textarea
              className="w-full px-3 py-2 border rounded-lg"
              rows={2}
              value={bienPhapKhanCap}
              onChange={(e) => setBienPhapKhanCap(e.target.value)}
              placeholder="VD: Di tản công nhân khỏi khu vực, căng rào cảnh báo..."
            />
          </FormItem>

          <FormItem label="Hình ảnh hiện trường sự cố (Tối đa 5 ảnh)">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => { if (uploadedFiles.length < 5) document.getElementById('report-emergency-file')?.click(); }}
              className={`mt-1 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-red-500 bg-red-50'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80'
              } ${uploadedFiles.length >= 5 ? 'cursor-not-allowed opacity-90' : ''}`}
              style={{ padding: uploadedFiles.length > 0 ? '16px' : '24px' }}
            >
              <input
                type="file"
                id="report-emergency-file"
                style={{ display: 'none' }}
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                disabled={uploadedFiles.length >= 5}
              />

              {uploadedFiles.length > 0 ? (
                <div>
                  <div
                    className="flex flex-wrap items-center justify-center gap-3 my-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {uploadedFiles.map((fileState) => (
                      <div
                        key={fileState.id}
                        className={`relative w-16 h-16 rounded shadow-sm border overflow-hidden group ${
                          fileState.status === 'error' ? 'border-red-500' : fileState.status === 'success' ? 'border-green-500' : 'border-slate-200'
                        }`}
                      >
                        <LazyImage src={fileState.url} alt={fileState.name} widthOption={200} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                        {fileState.status === 'uploading' && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Loader2 size={14} className="animate-spin text-white" />
                          </div>
                        )}

                        {fileState.status === 'error' && (
                          <>
                            <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[8px] text-center py-0.5 font-bold">Lỗi</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                retryUpload(fileState.id);
                              }}
                              className="absolute top-1 left-1 bg-blue-600 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                              title="Thử lại upload"
                            >
                              <RotateCcw size={10} />
                            </button>
                          </>
                        )}

                        {fileState.status === 'success' && (
                          <span className="absolute bottom-0 left-0 right-0 bg-green-600 text-white text-[8px] text-center py-0.5 font-bold">Mới</span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(fileState.id);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-90 hover:opacity-100 transition-opacity z-10"
                          title="Xóa ảnh"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {uploadedFiles.length < 5 ? (
                    <div className="mt-3 text-xs text-blue-600 font-semibold">
                      <span
                        className="cursor-pointer hover:underline"
                        onClick={() => document.getElementById('report-emergency-file')?.click()}
                      >
                        + Thêm ảnh khác (Đã chọn {uploadedFiles.length}/5 ảnh)
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-500 font-medium">
                      Đã đạt tối đa 5/5 ảnh
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <UploadCloud size={32} className="text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-600 mb-0.5">
                    Kéo thả hình ảnh vào đây hoặc click để chọn ảnh
                  </p>
                  <span className="text-xs text-slate-400">
                    Hỗ trợ tối đa 5 ảnh, dung lượng tối đa 10MB/ảnh
                  </span>
                </div>
              )}
            </div>
          </FormItem>

        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid hsl(var(--border))', paddingTop: '12px' }}>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={mutation.isPending}
            disabled={mutation.isPending}
            style={{ background: 'hsl(0, 72%, 45%)' }}
          >
            Gửi biên bản báo cáo dừng dự án
          </Button>
        </div>
      </div>
    </Modal>
  );
};
