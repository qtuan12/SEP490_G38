import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button, FormItem } from '../../../components/ui';
import { incidentService } from '../../../services/incidentService';
import { toast } from 'react-hot-toast';

interface CreateRecoveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: number;
  projectName?: string;
  onSuccess: (msg: string) => void;
}

export const CreateRecoveryPlanModal: React.FC<CreateRecoveryPlanModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  projectName = '',
  onSuccess
}) => {
  const queryClient = useQueryClient();
  const [cost, setCost] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);

  // Form states matching the official 8-section layout
  const [tenCongTrinh, setTenCongTrinh] = useState('');
  const [diaChiCongTrinh, setDiaChiCongTrinh] = useState('');
  const [chuDauTu, setChuDauTu] = useState('');
  const [nhaThauThiCong, setNhaThauThiCong] = useState('Công ty Cổ phần Xây dựng BPG');
  const [donViGiamSat, setDonViGiamSat] = useState('');
  const [thoiGianXayRa, setThoiGianXayRa] = useState('');
  const [loaiSuCo, setLoaiSuCo] = useState('');
  const [moTaChiTiet, setMoTaChiTiet] = useState('');
  const [nguyenNhanBanDau, setNguyenNhanBanDau] = useState('');
  const [thietHaiConNguoi, setThietHaiConNguoi] = useState('Không có thiệt hại về người.');
  const [thietHaiVatChat, setThietHaiVatChat] = useState('');
  const [thietHaiKhac, setThietHaiKhac] = useState('');
  const [bienPhapDaThucHien, setBienPhapDaThucHien] = useState('');
  const [deXuatHuongXuLy, setDeXuatHuongXuLy] = useState('');
  const [chungKienHoTen, setChungKienHoTen] = useState('');
  const [chungKienLienHe, setChungKienLienHe] = useState('');
  const [yKienChuDauTu, setYKienChuDauTu] = useState('');
  const [yKienNhaThau, setYKienNhaThau] = useState('');
  const [yKienGiamSat, setYKienGiamSat] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShowPreview(false);
      setCost(0);
      setTenCongTrinh(projectName || '');
      setDiaChiCongTrinh('');
      setChuDauTu('');
      setNhaThauThiCong('Công ty Cổ phần Xây dựng BPG');
      setDonViGiamSat('');
      setThoiGianXayRa('');
      setLoaiSuCo('Sạt lở đất / Mưa lũ lớn ảnh hưởng công trình');
      setMoTaChiTiet('');
      setNguyenNhanBanDau('');
      setThietHaiConNguoi('Không có thiệt hại về người.');
      setThietHaiVatChat('');
      setThietHaiKhac('');
      setBienPhapDaThucHien('');
      setDeXuatHuongXuLy('');
      setChungKienHoTen('');
      setChungKienLienHe('');
      setYKienChuDauTu('');
      setYKienNhaThau('');
      setYKienGiamSat('');
    }
  }, [isOpen, projectName]);

  const mutation = useMutation({
    mutationFn: () => {
      const docData = {
        tenCongTrinh,
        diaChiCongTrinh,
        chuDauTu,
        nhaThauThiCong,
        donViGiamSat,
        thoiGianXayRa,
        loaiSuCo,
        moTaChiTiet,
        nguyenNhanBanDau,
        thietHaiConNguoi,
        thietHaiVatChat,
        thietHaiKhac,
        bienPhapDaThucHien,
        deXuatHuongXuLy,
        chungKienHoTen,
        chungKienLienHe,
        yKienChuDauTu,
        yKienNhaThau,
        yKienGiamSat
      };
      
      return incidentService.confirmIncident(incidentId, {
        incidentId,
        createReworkTask: false,
        recoveryPlanText: JSON.stringify(docData),
        recoveryEstimateCost: cost,
      });
    },
    onSuccess: () => {
      toast.success('Đã trình hồ sơ lên Giám đốc phê duyệt');
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      onSuccess('Trình hồ sơ thành công');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Lỗi khi nộp báo cáo.');
    }
  });

  const handleSubmitReport = () => {
    if (!tenCongTrinh.trim() || !moTaChiTiet.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin cốt lõi (Tên công trình, Mô tả chi tiết).');
      return;
    }
    mutation.mutate();
  };

  if (!isOpen) return null;

  if (showPreview) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="🔍 Xem trước Báo cáo Sự cố Công trình" width="xl">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ padding: '10px 14px', background: 'hsl(var(--primary-glow))', borderRadius: '8px', border: '1px solid hsl(var(--primary)/0.2)' }}>
            <strong style={{ color: 'hsl(var(--primary))', fontSize: '0.85rem', display: 'block' }}>
              Chế độ Xem trước Biên bản
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
              Đây là hình ảnh tài liệu mô phỏng khi in hoặc xuất file Word. Hãy rà soát kỹ thông tin trước khi nộp.
            </span>
          </div>

          <div style={{ padding: '24px 30px', background: '#fff', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: '#000', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.05rem', lineHeight: '1.6', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
            {/* Official Heading */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '0.85rem', lineHeight: '1.4', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
              <div style={{ textAlign: 'center', width: '45%' }}>
                <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br/>
                Ban Quản lý Dự án: {projectName || 'Dự án CMS'}<br/>
                ---
              </div>
              <div style={{ textAlign: 'center', width: '50%' }}>
                <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
                <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
                ---
              </div>
            </div>

            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.3rem', margin: '20px 0 5px 0', textTransform: 'uppercase' }}>
              BÁO CÁO SỰ CỐ CÔNG TRÌNH XÂY DỰNG
            </div>
            <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '24px', color: '#666' }}>
              (Biên bản được thiết lập theo mẫu hợp đồng số CMS)
            </div>

            {/* Document Fields */}
            <div style={{ textAlign: 'justify' }}>
              <p style={{ margin: '12px 0 6px 0' }}><strong>1. Thông tin công trình</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Tên công trình: <strong>{tenCongTrinh || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Địa chỉ công trình: <strong>{diaChiCongTrinh || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Chủ đầu tư: <strong>{chuDauTu || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Nhà thầu thi công: <strong>{nhaThauThiCong || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Đơn vị tư vấn giám sát: <strong>{donViGiamSat || '...........................................................................'}</strong></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>2. Thời gian xảy ra sự cố</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Ngày, giờ xảy ra: <strong>{thoiGianXayRa || '...........................................................................'}</strong></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>3. Mô tả sự cố</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Loại sự cố: <strong>{loaiSuCo || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Mô tả chi tiết: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{moTaChiTiet || '...........................................................................'}</span></p>
                <p style={{ margin: '4px 0' }}>- Nguyên nhân ban đầu (nếu có): <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{nguyenNhanBanDau || '...........................................................................'}</span></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>4. Thiệt hại do sự cố (nếu có)</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Thiệt hại về con người: <strong>{thietHaiConNguoi || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Thiệt hại về vật chất: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{thietHaiVatChat || '...........................................................................'}</span></p>
                <p style={{ margin: '4px 0' }}>- Thiệt hại khác: <strong>{thietHaiKhac || '...........................................................................'}</strong></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>5. Biện pháp khắc phục ban đầu</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Các hành động đã thực hiện: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{bienPhapDaThucHien || '...........................................................................'}</span></p>
                <p style={{ margin: '4px 0' }}>- Đề xuất hướng xử lý tiếp theo: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{deXuatHuongXuLy || '...........................................................................'}</span></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>6. Các bên liên quan chứng kiến sự cố</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Họ và tên: <strong>{chungKienHoTen || '...........................................................................'}</strong></p>
                <p style={{ margin: '4px 0' }}>- Liên hệ: <strong>{chungKienLienHe || '...........................................................................'}</strong></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>7. Ý kiến của các bên</strong></p>
              <div style={{ paddingLeft: '14px' }}>
                <p style={{ margin: '4px 0' }}>- Chủ đầu tư: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{yKienChuDauTu || '...........................................................................'}</span></p>
                <p style={{ margin: '4px 0' }}>- Nhà thầu thi công: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{yKienNhaThau || '...........................................................................'}</span></p>
                <p style={{ margin: '4px 0' }}>- Tư vấn giám sát (nếu có): <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{yKienGiamSat || '...........................................................................'}</span></p>
              </div>

              <p style={{ margin: '16px 0 6px 0' }}><strong>8. Kết luận và cam kết</strong></p>
              <p style={{ paddingLeft: '14px', margin: '4px 0' }}>Chúng tôi cam kết thông tin trong báo cáo là chính xác và sẽ phối hợp thực hiện các biện pháp khắc phục theo quy định.</p>
              
              <p style={{ margin: '16px 0 6px 0' }}><strong>Tổng kinh phí khắc phục dự toán (VNĐ):</strong> <strong style={{ color: 'hsl(var(--primary))' }}>{cost.toLocaleString('vi-VN')} VNĐ</strong></p>
            </div>

            {/* Signature block preview */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '36px', marginBottom: '16px', textTransform: 'uppercase' }}>
              ĐẠI DIỆN CÁC BÊN THAM GIA LẬP BIÊN BẢN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '0.82rem', textAlign: 'center', marginTop: '10px' }}>
              <div>
                <strong>Đại diện chủ đầu tư</strong><br/>
                <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                <div style={{ height: '50px' }}></div>
                <span>.......................................</span>
              </div>
              <div>
                <strong>Đại diện nhà thầu thi công</strong><br/>
                <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                <div style={{ height: '50px' }}></div>
                <strong>Lê Minh Tuấn</strong>
              </div>
              <div>
                <strong>Đại diện tư vấn giám sát (nếu có)</strong><br/>
                <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                <div style={{ height: '50px' }}></div>
                <span>.......................................</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <Button variant="outline" onClick={() => setShowPreview(false)} disabled={mutation.isPending}>
              ⬅ Quay lại chỉnh sửa
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitReport}
              isLoading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Nộp báo cáo trình Giám đốc
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📝 Lập Báo cáo & Kế hoạch Khắc phục Sự cố (Hợp đồng số)" width="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
        
        {/* Banner */}
        <div style={{ padding: '12px 16px', background: 'hsl(var(--primary-glow))', borderRadius: '8px', border: '1px solid hsl(var(--primary)/0.2)' }}>
          <strong style={{ color: 'hsl(var(--primary))', fontSize: '0.88rem', display: 'block' }}>
            Hệ thống lập Biên bản & Báo cáo kỹ thuật số
          </strong>
          <span style={{ fontSize: '0.78rem', color: 'hsl(var(--text-secondary))' }}>
            Vui lòng nhập thông tin vào các trường dưới đây. Hệ thống sẽ tự động xuất biên bản định dạng tiêu chuẩn.
          </span>
        </div>

        {/* Section 1: Thông tin công trình */}
        <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '10px' }}>
          <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))', marginBottom: '12px', textTransform: 'uppercase' }}>
            1. Thông tin công trình
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <FormItem label="Tên công trình" required>
              <input className="input" value={tenCongTrinh} onChange={e => setTenCongTrinh(e.target.value)} />
            </FormItem>
            <FormItem label="Địa chỉ công trình" required>
              <input className="input" value={diaChiCongTrinh} onChange={e => setDiaChiCongTrinh(e.target.value)} placeholder="Nhập địa chỉ dự án..." />
            </FormItem>
            <FormItem label="Chủ đầu tư">
              <input className="input" value={chuDauTu} onChange={e => setChuDauTu(e.target.value)} placeholder="Nhập tên chủ đầu tư..." />
            </FormItem>
            <FormItem label="Nhà thầu thi công">
              <input className="input" value={nhaThauThiCong} onChange={e => setNhaThauThiCong(e.target.value)} />
            </FormItem>
            <div style={{ gridColumn: 'span 2' }}>
              <FormItem label="Đơn vị tư vấn giám sát">
                <input className="input" value={donViGiamSat} onChange={e => setDonViGiamSat(e.target.value)} placeholder="Nhập tên đơn vị tư vấn giám sát..." />
              </FormItem>
            </div>
          </div>
        </div>

        {/* Section 2 & 3: Thời gian và mô tả */}
        <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '10px' }}>
          <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))', marginBottom: '12px', textTransform: 'uppercase' }}>
            2 & 3. Thời gian và Mô tả sự cố
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <FormItem label="Ngày, giờ xảy ra sự cố" required>
              <input className="input" type="text" value={thoiGianXayRa} onChange={e => setThoiGianXayRa(e.target.value)} placeholder="Ví dụ: 08:30 ngày 12/07/2026..." />
            </FormItem>
            <FormItem label="Loại sự cố" required>
              <input className="input" value={loaiSuCo} onChange={e => setLoaiSuCo(e.target.value)} />
            </FormItem>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FormItem label="Mô tả chi tiết diễn biến sự cố" required>
              <textarea className="input" rows={3} value={moTaChiTiet} onChange={e => setMoTaChiTiet(e.target.value)} placeholder="Mô tả vị trí, quy mô, ảnh hưởng cấu kiện..." />
            </FormItem>
            <FormItem label="Nguyên nhân sơ bộ ban đầu">
              <textarea className="input" rows={2} value={nguyenNhanBanDau} onChange={e => setNguyenNhanBanDau(e.target.value)} placeholder="Ví dụ: Lượng mưa vượt mức lịch sử gây ngập..." />
            </FormItem>
          </div>
        </div>

        {/* Section 4 & 5: Thiệt hại và biện pháp */}
        <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '10px' }}>
          <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))', marginBottom: '12px', textTransform: 'uppercase' }}>
            4 & 5. Đánh giá Thiệt hại & Biện pháp khắc phục
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
            <FormItem label="Thiệt hại về con người" required>
              <input className="input" value={thietHaiConNguoi} onChange={e => setThietHaiConNguoi(e.target.value)} />
            </FormItem>
            <FormItem label="Thiệt hại về vật chất (Hạng mục công trình)" required>
              <textarea className="input" rows={3} value={thietHaiVatChat} onChange={e => setThietHaiVatChat(e.target.value)} placeholder="Liệt kê kết cấu bị sập đổ, hư hỏng..." />
            </FormItem>
            <FormItem label="Thiệt hại khác (Tiến độ, môi trường...)">
              <input className="input" value={thietHaiKhac} onChange={e => setThietHaiKhac(e.target.value)} placeholder="Ví dụ: Chậm tiến độ 15 ngày..." />
            </FormItem>
            <FormItem label="Các hành động khẩn cấp đã thực hiện">
              <textarea className="input" rows={2} value={bienPhapDaThucHien} onChange={e => setBienPhapDaThucHien(e.target.value)} placeholder="Ví dụ: Di dời công nhân, ngắt điện, rào chắn..." />
            </FormItem>
            <FormItem label="Đề xuất hướng xử lý lâu dài">
              <textarea className="input" rows={2} value={deXuatHuongXuLy} onChange={e => setDeXuatHuongXuLy(e.target.value)} placeholder="Ví dụ: Gia cố lại móng, đổ lại bê tông..." />
            </FormItem>
          </div>
        </div>

        {/* Section 6 & 7: Bên chứng kiến & Ý kiến các bên */}
        <div style={{ borderBottom: '1px solid hsl(var(--border))', paddingBottom: '10px' }}>
          <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))', marginBottom: '12px', textTransform: 'uppercase' }}>
            6 & 7. Bên chứng kiến & Ý kiến các bên
          </h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <FormItem label="Họ tên người chứng kiến sự cố">
              <input className="input" value={chungKienHoTen} onChange={e => setChungKienHoTen(e.target.value)} placeholder="Nhập họ tên..." />
            </FormItem>
            <FormItem label="Liên hệ (SĐT / Email)">
              <input className="input" value={chungKienLienHe} onChange={e => setChungKienLienHe(e.target.value)} placeholder="Nhập SĐT..." />
            </FormItem>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <FormItem label="Ý kiến của Chủ đầu tư (nếu có)">
              <textarea className="input" rows={2} value={yKienChuDauTu} onChange={e => setYKienChuDauTu(e.target.value)} placeholder="Nhập ý kiến..." />
            </FormItem>
            <FormItem label="Ý kiến của Nhà thầu thi công">
              <textarea className="input" rows={2} value={yKienNhaThau} onChange={e => setYKienNhaThau(e.target.value)} placeholder="Nhập ý kiến..." />
            </FormItem>
            <FormItem label="Ý kiến của Đơn vị Tư vấn giám sát">
              <textarea className="input" rows={2} value={yKienGiamSat} onChange={e => setYKienGiamSat(e.target.value)} placeholder="Nhập ý kiến..." />
            </FormItem>
          </div>
        </div>

        {/* Ngân sách */}
        <div>
          <h5 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))', marginBottom: '12px', textTransform: 'uppercase' }}>
            Dự toán kinh phí
          </h5>
          <FormItem label="Tổng kinh phí khắc phục dự toán (VNĐ)" required>
            <input
              className="input"
              type="number"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              placeholder="Ví dụ: 150000000"
            />
          </FormItem>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Hủy
          </Button>
          <Button
            variant="outline"
            style={{ color: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary)/0.5)' }}
            onClick={() => setShowPreview(true)}
            disabled={mutation.isPending}
          >
            🔍 Xem trước biên bản
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitReport}
            isLoading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Nộp báo cáo trình Giám đốc
          </Button>
        </div>
      </div>
    </Modal>
  );
};
