import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { projectService } from '../../../services/projectService';
import { UploadCloud, X } from 'lucide-react';
import { toast } from 'react-hot-toast';


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

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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

      if (selectedFiles.length > 0) {
        const uploadedUrls = await projectService.uploadFiles(selectedFiles, 'incidents');
        if (uploadedUrls && uploadedUrls.length > 0) {
          finalDescJson.imageUrls = uploadedUrls;
        }
      }

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
      setSelectedFiles([]);
      setPreviews([]);
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
    const remaining = 5 - selectedFiles.length;
    if (remaining <= 0) {
      toast.error('Đã đạt giới hạn tối đa 5 ảnh.');
      return;
    }
    const MAX = 10 * 1024 * 1024;
    if (files.some(f => f.size > MAX)) {
      toast.error('Hình ảnh không được vượt quá 10MB.');
      return;
    }
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, remaining);
    if (!valid.length) return;
    setSelectedFiles(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
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
    <Modal isOpen={isOpen} onClose={onClose} title="🛑 Biên bản Báo cáo Sự cố Công trình & Yêu cầu dừng" width="lg">
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

          <FormItem label="Hình ảnh hiện trường sự cố">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragging ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragging ? 'hsl(var(--primary-glow))' : 'hsl(var(--bg-card))',
                transition: 'all 0.2s ease',
              }}
              onClick={() => document.getElementById('report-emergency-file')?.click()}
            >
              <UploadCloud size={32} style={{ margin: '0 auto 8px', color: 'hsl(var(--text-muted))' }} />
              <p style={{ fontSize: '0.82rem', color: 'hsl(var(--text-secondary))', margin: 0 }}>
                Kéo thả hình ảnh vào đây hoặc click để chọn ảnh (Tối đa 5 ảnh)
              </p>
              <input
                type="file"
                id="report-emergency-file"
                style={{ display: 'none' }}
                multiple
                accept="image/*"
                onChange={handleFileSelect}
              />
            </div>

            {previews.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {previews.map((src, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
                    <img src={src} alt="Xem trước" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(idx);
                      }}
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        borderRadius: '50%',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
