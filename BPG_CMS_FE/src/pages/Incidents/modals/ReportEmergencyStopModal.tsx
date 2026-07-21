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

export const ReportEmergencyStopModal: React.FC<ReportEmergencyStopModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName = '',
  onSuccess,
}) => {
  const [soBienBan, setSoBienBan] = useState(() => `BB-INC-${Date.now().toString().slice(-6)}`);
  const [ngayLap, setNgayLap] = useState(() => {
    const today = new Date();
    return `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
  });
  
  const [hangMuc, setHangMuc] = useState('');
  const [thoiGianXayRa, setThoiGianXayRa] = useState('');
  const [diaDiem, setDiaDiem] = useState('');
  const [loaiSuCo, setLoaiSuCo] = useState('Sự cố ngừng thi công khẩn cấp');
  const [mucDo, setMucDo] = useState('Khẩn cấp');
  
  const [moTaSuCo, setMoTaSuCo] = useState('');
  const [thietHaiConNguoi, setThietHaiConNguoi] = useState('Không có');
  const [thietHaiTienDo, setThietHaiTienDo] = useState('Tạm dừng thi công toàn dự án');
  
  interface MaterialDamage {
    stt: number;
    tenVatLieu: string;
    chiPhiSoBo: number;
  }
  const [damagedMaterials, setDamagedMaterials] = useState<MaterialDamage[]>([
    { stt: 1, tenVatLieu: '', chiPhiSoBo: 0 }
  ]);
  
  const [nguyenNhanBanDau, setNguyenNhanBanDau] = useState('');
  const [bienPhapKhanCap, setBienPhapKhanCap] = useState('');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const addMaterialRow = () => {
    setDamagedMaterials(prev => [
      ...prev,
      { stt: prev.length + 1, tenVatLieu: '', chiPhiSoBo: 0 }
    ]);
  };

  const removeMaterialRow = (idx: number) => {
    if (damagedMaterials.length === 1) {
      setDamagedMaterials([{ stt: 1, tenVatLieu: '', chiPhiSoBo: 0 }]);
      return;
    }
    const updated = damagedMaterials.filter((_, i) => i !== idx).map((item, i) => ({
      ...item,
      stt: i + 1
    }));
    setDamagedMaterials(updated);
  };

  const handleMaterialChange = (idx: number, field: 'tenVatLieu' | 'chiPhiSoBo', value: any) => {
    const updated = [...damagedMaterials];
    updated[idx] = {
      ...updated[idx],
      [field]: field === 'chiPhiSoBo' ? (Number(value) || 0) : value
    };
    setDamagedMaterials(updated);
  };

  const totalCost = damagedMaterials.reduce((sum, item) => sum + item.chiPhiSoBo, 0);

  const mutation = useMutation({
    mutationFn: async () => {
      let finalDescJson: any = {
        soBienBan: soBienBan.trim(),
        ngayLap: ngayLap.trim(),
        congTrinh: projectName.trim(),
        hangMuc: hangMuc.trim(),
        thoiGianXayRa: thoiGianXayRa.trim(),
        diaDiem: diaDiem.trim(),
        loaiSuCo: loaiSuCo.trim(),
        mucDo,
        moTaSuCo: moTaSuCo.trim(),
        thietHaiConNguoi: thietHaiConNguoi.trim(),
        thietHaiTaiSan: JSON.stringify(damagedMaterials),
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
        damageDescription: JSON.stringify(damagedMaterials),
        estimatedMaterialLoss: totalCost,
        estimatedLaborDays: 0,
        estimatedDelayDays: 0,
      });
    },
    onSuccess: () => {
      onSuccess('Biên bản báo cáo sự cố khẩn cấp đã được gửi thành công lên TPKT.');
      setSoBienBan(`BB-INC-${Date.now().toString().slice(-6)}`);
      setHangMuc('');
      setThoiGianXayRa('');
      setDiaDiem('');
      setMoTaSuCo('');
      setThietHaiConNguoi('Không có');
      setDamagedMaterials([{ stt: 1, tenVatLieu: '', chiPhiSoBo: 0 }]);
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
    const hasInvalidMaterial = damagedMaterials.some(item => !item.tenVatLieu.trim());
    if (hasInvalidMaterial) {
      toast.error('Vui lòng nhập đầy đủ tên vật liệu/tài sản bị thiệt hại.');
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormItem label="Số biên bản (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={soBienBan}
                onChange={(e) => setSoBienBan(e.target.value)}
                placeholder="VD: BB-INC-001"
              />
            </FormItem>
            <FormItem label="Ngày lập (*)" required>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={ngayLap}
                onChange={(e) => setNgayLap(e.target.value)}
                placeholder="Ngày/Tháng/Năm"
              />
            </FormItem>
          </div>

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
                type="text"
                className="w-full px-3 py-2 border rounded-lg"
                value={thoiGianXayRa}
                onChange={(e) => setThoiGianXayRa(e.target.value)}
                placeholder="VD: 14:30 ngày 20/07/2026"
              />
            </FormItem>
            <FormItem label="Mức độ sự cố (*)" required>
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={mucDo}
                onChange={(e) => setMucDo(e.target.value)}
              >
                <option value="Thấp">Thấp</option>
                <option value="TB">Trung bình</option>
                <option value="Cao">Cao</option>
                <option value="Khẩn cấp">Khẩn cấp</option>
              </select>
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
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Danh sách tài sản/vật tư bị thiệt hại (*)
            </span>
            <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'hsl(var(--bg-muted))', borderBottom: '1px solid hsl(var(--border))' }}>
                    <th style={{ padding: '8px 10px', width: '50px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>STT</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Tên vật liệu / Tài sản hỏng</th>
                    <th style={{ padding: '8px 10px', width: '200px', textAlign: 'right', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Ước tính chi phí sơ bộ (VNĐ)</th>
                    <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {damagedMaterials.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
                        {item.stt}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="text"
                          className="w-full px-2 py-1 border rounded"
                          style={{ fontSize: '0.85rem' }}
                          value={item.tenVatLieu}
                          onChange={(e) => handleMaterialChange(idx, 'tenVatLieu', e.target.value)}
                          placeholder="Tên vật tư, hạng mục bị hỏng..."
                        />
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <input
                          type="number"
                          className="w-full px-2 py-1 border rounded text-right"
                          style={{ fontSize: '0.85rem' }}
                          value={item.chiPhiSoBo === 0 ? '' : item.chiPhiSoBo}
                          onChange={(e) => handleMaterialChange(idx, 'chiPhiSoBo', e.target.value)}
                          placeholder="0"
                        />
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeMaterialRow(idx)}
                          style={{
                            color: 'hsl(var(--destructive))',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                          title="Xóa dòng"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'hsl(var(--bg-muted))', fontWeight: 600 }}>
                    <td colSpan={2} style={{ padding: '10px', textAlign: 'right', color: 'hsl(var(--text-secondary))' }}>
                      Tổng thiệt hại:
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', color: 'hsl(var(--destructive))', fontSize: '0.9rem', fontWeight: 700 }}>
                      {totalCost.toLocaleString('vi-VN')} VNĐ
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addMaterialRow}
              style={{
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'hsl(var(--primary))',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ➕ Thêm vật liệu / tài sản hỏng
            </button>
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
