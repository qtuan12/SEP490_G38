import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { incidentService } from '../../../services/incidentService';
import { Modal } from '../../../components/ui/Modal';
import { MiniMarkdown } from '../../../components/ui/MiniMarkdown';
import { CreateRecoveryPlanForm } from './CreateRecoveryPlanModal';
import type { IncidentReport, WBSPhase, WBSTask, ProjectMember } from '../../../types/common';
import { ResolveIncidentForm } from './ResolveIncidentModal';
import { ArrowRight, ArrowLeft, AlertCircle, CheckCircle, HardHat, Package, MapPin, Clock, Users, BarChart3, FileText } from 'lucide-react';
import { inventoryService } from '../../../services/inventoryService';
import type { CurrentInventory } from '../../../types/inventory';
import { useProjectAccess } from '../../../hooks/useProjectAccess';
interface IncidentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentReport;
  phase: WBSPhase | null;
  user: { id: string; name: string; role: string } | null;
  onResolveClick: () => void;
  onSuccessAction?: (msg?: string) => void;
  task?: WBSTask;
  members?: ProjectMember[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

const INCIDENT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.FC<any> }> = {
  Construction: {
    label: 'Sự cố Thi công',
    color: 'hsl(28, 90%, 50%)',
    bg: 'hsl(28, 100%, 97%)',
    border: 'hsl(28, 80%, 78%)',
    icon: HardHat,
  },
  InventoryLoss: {
    label: 'Sự cố Vật tư Kho',
    color: 'hsl(210, 70%, 45%)',
    bg: 'hsl(210, 100%, 97%)',
    border: 'hsl(210, 70%, 78%)',
    icon: Package,
  },
  InventoryDamage: {
    label: 'Sự cố Vật tư Kho',
    color: 'hsl(210, 70%, 45%)',
    bg: 'hsl(210, 100%, 97%)',
    border: 'hsl(210, 70%, 78%)',
    icon: Package,
  },
};

function extractMetaFromDesc(description: string): { mainDesc: string; meta: Record<string, string> } {
  // Split the leading body from metadata lines prefixed with **Key:**
  const lines = description.split('\n');
  const metaLines: Record<string, string> = {};
  const bodyLines: string[] = [];
  let metaStarted = false;

  for (const line of lines) {
    const match = line.match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    if (match) {
      metaStarted = true;
      metaLines[match[1].trim()] = match[2].trim();
    } else if (metaStarted && line.trim() === '') {
      // skip blank after meta
    } else {
      bodyLines.push(line);
    }
  }

  return { mainDesc: bodyLines.join('\n').trim(), meta: metaLines };
}

// ── component ─────────────────────────────────────────────────────────────────

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  isOpen,
  onClose,
  incident,
  phase,
  task,
  members,
  user,
  onResolveClick,
  onSuccessAction
}) => {
  const { isProjectLeader } = useProjectAccess(incident.projectId);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isResubmittingByDirector, setIsResubmittingByDirector] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [inventory, setInventory] = useState<CurrentInventory[]>([]);

  useEffect(() => {
    if (isOpen && incident && (incident.incidentType === 'InventoryLoss' || incident.incidentType === 'InventoryDamage')) {
      inventoryService.getCurrentInventory(Number(incident.projectId))
        .then(res => setInventory(res))
        .catch(console.error);
    }
  }, [isOpen, incident]);

  const queryClient = useQueryClient();

  const rejectMutation = useMutation({
    mutationFn: () => incidentService.rejectIncident(Number(incident.id), rejectReason),
    onSuccess: (result) => {
      console.log(result.message || 'Đã từ chối sự cố.');
      if (onSuccessAction) onSuccessAction('Đã từ chối sự cố');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      setIsRejecting(false);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể từ chối sự cố.');
    }
  });

  const directorResubmitMutation = useMutation({
    mutationFn: () =>
      incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        decision: 'Resubmit',
        handlingInstruction: rejectReason,
      }),
    onSuccess: (result) => {
      console.log(result.message || 'Đã yêu cầu TPKT làm lại hồ sơ khắc phục.');
      if (onSuccessAction) onSuccessAction('Yêu cầu làm lại hồ sơ');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      setIsResubmittingByDirector(false);
      setRejectReason('');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể yêu cầu làm lại hồ sơ khắc phục.');
    }
  });

  const approveStopMutation = useMutation({
    mutationFn: () =>
      incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        handlingInstruction: 'Phê duyệt tạm dừng thi công khẩn cấp để đánh giá thiệt hại hiện trường.',
      }),
    onSuccess: (result) => {
      console.log(result.message || 'Đã phê duyệt dừng thi công và tạm dừng dự án.');
      if (onSuccessAction) onSuccessAction('Phê duyệt dừng thi công');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể duyệt dừng thi công.');
    }
  });

  const directorApproveDirectlyMutation = useMutation({
    mutationFn: () =>
      incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        decision: 'Approve',
        handlingInstruction: 'Giám đốc phê duyệt Báo cáo & Kế hoạch khắc phục thiệt hại toàn dự án.',
      }),
    onSuccess: (result) => {
      console.log(result.message || 'Đã phê duyệt hồ sơ khắc phục và kích hoạt lại dự án.');
      if (onSuccessAction) onSuccessAction('Phê duyệt hồ sơ khắc phục');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể phê duyệt hồ sơ khắc phục.');
    }
  });

  const directorApproveInventoryMutation = useMutation({
    mutationFn: () =>
      incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        handlingInstruction: 'Giám đốc phê duyệt điều chỉnh giảm tồn kho vật tư bị thiệt hại.',
      }),
    onSuccess: (result) => {
      console.log(result.message || 'Đã phê duyệt phiếu giảm tồn kho. Tồn kho đã được cập nhật.');
      if (onSuccessAction) onSuccessAction('Phê duyệt giảm tồn kho');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể phê duyệt phiếu giảm tồn kho.');
    }
  });


  const plPushToAccountantMutation = useMutation({
    mutationFn: () =>
      incidentService.confirmIncident(Number(incident.id), {
        incidentId: Number(incident.id),
        createReworkTask: false,
        handlingInstruction: 'Trưởng dự án xác nhận và chuyển Kế toán xử lý.',
      }),
    onSuccess: (result) => {
      console.log(result.message || 'Đã chuyển sự cố vật tư cho Kế toán.');
      if (onSuccessAction) onSuccessAction('Đã chuyển Kế toán');
      else {
        queryClient.invalidateQueries({ queryKey: ['incidents'] });
        queryClient.invalidateQueries({ queryKey: ['globalIncidents'] });
      }
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Không thể chuyển sự cố vật tư.');
    }
  });


  const convertMarkdownToHtml = (md: string): string => {
    let html = md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHtml = '<table style="width:100%; border-collapse:collapse; margin: 15px 0; font-size: 11pt;">';
        }

        const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

        if (line.includes('---')) {
          continue;
        }

        const isHeader = line.includes('Hạng mục') || line.includes('STT') || line.includes('Đơn vị');
        const rowStyle = 'border: 1px solid #000; padding: 6px 10px; text-align: left;';
        const cellTag = isHeader ? 'th' : 'td';
        const cellWeight = isHeader ? 'font-weight:bold; background-color:#f2f2f2; text-align: center;' : '';

        tableHtml += '<tr>';
        cells.forEach(cell => {
          tableHtml += `<${cellTag} style="${rowStyle} ${cellWeight}">${cell}</${cellTag}>`;
        });
        tableHtml += '</tr>';
      } else {
        if (inTable) {
          inTable = false;
          tableHtml += '</table>';
          lines[i] = tableHtml + '\n' + lines[i];
        }
      }
    }
    if (inTable) {
      tableHtml += '</table>';
      lines[lines.length - 1] = tableHtml;
    }

    html = lines.join('\n');

    html = html
      .replace(/^### (.*?)$/gm, '<h3 style="font-size:12pt; font-weight:bold; margin-top:15px; margin-bottom:5px;">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 style="font-size:13pt; font-weight:bold; margin-top:18px; margin-bottom:5px;">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 style="font-size:14pt; font-weight:bold; margin-top:20px; margin-bottom:5px; border-bottom:1px solid #000; padding-bottom:3px; text-transform:uppercase;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\s*[\-\*]\s+(.*?)$/gm, '<li style="margin-left:20px; list-style-type:disc; margin-bottom:4px;">$1</li>')
      .replace(/\n/g, '<br/>');

    return html;
  };

  const getDocumentBodyHtml = (): string => {
    if (!incident.recoveryPlanText) return '';
    if (incident.recoveryPlanText.startsWith('{')) {
      try {
        const doc = JSON.parse(incident.recoveryPlanText);
        if (doc.maKeHoach) {
          const stepsHtml = doc.keHoachThucHien?.map((step: any) => `
            <tr>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">${step.stt}</td>
              <td style="border: 1px solid #000; padding: 6px;">${step.congViec}</td>
              <td style="border: 1px solid #000; padding: 6px;">${step.nguoiPhuTrach}</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">${step.thoiHan}</td>
              <td style="border: 1px solid #000; padding: 6px;">${step.ketQua}</td>
              <td style="border: 1px solid #000; padding: 6px;">${step.ghiChu || ''}</td>
            </tr>
          `).join('') || '';

          return `
            <div style="font-size: 13pt;">
              <p><strong>Mục tiêu:</strong> ${doc.mucTieu || ''}</p>
              
              <p style="margin-top: 15px; font-weight: bold;">Kế hoạch thực hiện:</p>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11pt; margin-bottom: 15px;">
                <thead>
                  <tr style="background: #f2f2f2;">
                    <th style="border: 1px solid #000; padding: 6px; width: 40px; text-align: center;">STT</th>
                    <th style="border: 1px solid #000; padding: 6px;">Công việc</th>
                    <th style="border: 1px solid #000; padding: 6px; width: 130px;">Người phụ trách</th>
                    <th style="border: 1px solid #000; padding: 6px; width: 80px; text-align: center;">Thời hạn</th>
                    <th style="border: 1px solid #000; padding: 6px;">Kết quả</th>
                    <th style="border: 1px solid #000; padding: 6px;">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  ${stepsHtml}
                </tbody>
              </table>

              <p><strong>Chi phí dự kiến:</strong> ${incident.recoveryEstimateCost ? incident.recoveryEstimateCost.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ'}</p>
              
              <p style="margin-top: 15px;"><strong>Điều kiện nghiệm thu:</strong> ${doc.dieuKienNghiemThu || ''}</p>
            </div>
          `;
        }

        return `
          <div style="margin-top: 15px; font-size: 13pt;">
            <p style="margin-top: 15px; font-weight: bold;">1. Thông tin công trình</p>
            <div style="margin-left: 20px; line-height: 1.6;">
              <p>- Tên công trình: <strong>${doc.tenCongTrinh || '...........................................................................'}</strong></p>
              <p>- Địa chỉ công trình: <strong>${doc.diaChiCongTrinh || '...........................................................................'}</strong></p>
              <p>- Chủ đầu tư: <strong>${doc.chuDauTu || '...........................................................................'}</strong></p>
              <p>- Nhà thầu thi công: <strong>${doc.nhaThauThiCong || '...........................................................................'}</strong></p>
              <p>- Đơn vị tư vấn giám sát: <strong>${doc.donViGiamSat || '...........................................................................'}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">2. Thời gian xảy ra sự cố</p>
            <div style="margin-left: 20px;">
              <p>- Ngày, giờ xảy ra: <strong>${doc.thoiGianXayRa || '...........................................................................'}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">3. Mô tả sự cố</p>
            <div style="margin-left: 20px; line-height: 1.6;">
              <p>- Loại sự cố: <strong>${doc.loaiSuCo || '...........................................................................'}</strong></p>
              <p>- Mô tả chi tiết: <br/><strong>${(doc.moTaChiTiet || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
              <p>- Nguyên nhân ban đầu (nếu có): <br/><strong>${(doc.nguyenNhanBanDau || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">4. Thiệt hại do sự cố (nếu có)</p>
            <div style="margin-left: 20px; line-height: 1.6;">
              <p>- Thiệt hại về con người: <strong>${doc.thietHaiConNguoi || '...........................................................................'}</strong></p>
              <p>- Thiệt hại về vật chất: <br/><strong>${(doc.thietHaiVatChat || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
              <p>- Thiệt hại khác: <strong>${doc.thietHaiKhac || '...........................................................................'}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">5. Biện pháp khắc phục ban đầu</p>
            <div style="margin-left: 20px; line-height: 1.6;">
              <p>- Các hành động đã thực hiện: <br/><strong>${(doc.bienPhapDaThucHien || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
              <p>- Đề xuất hướng xử lý tiếp theo: <br/><strong>${(doc.deXuatHuongXuLy || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">6. Các bên liên quan chứng kiến sự cố</p>
            <div style="margin-left: 20px;">
              <p>- Họ và tên: <strong>${doc.chungKienHoTen || '...........................................................................'}</strong></p>
              <p>- Liên hệ: <strong>${doc.chungKienLienHe || '...........................................................................'}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">7. Ý kiến của các bên</p>
            <div style="margin-left: 20px; line-height: 1.6;">
              <p>- Chủ đầu tư: <br/><strong>${(doc.yKienChuDauTu || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
              <p>- Nhà thầu thi công: <br/><strong>${(doc.yKienNhaThau || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
              <p>- Tư vấn giám sát (nếu có): <br/><strong>${(doc.yKienGiamSat || '...........................................................................').replace(/\n/g, '<br/>')}</strong></p>
            </div>
            
            <p style="margin-top: 15px; font-weight: bold;">8. Kết luận và cam kết</p>
            <div style="margin-left: 20px;">
              <p>Chúng tôi cam kết thông tin trong báo cáo là chính xác và sẽ phối hợp thực hiện các biện pháp khắc phục theo quy định.</p>
            </div>
          </div>
        `;
      } catch (e) {
        console.error('Lỗi parse json', e);
      }
    }
    return convertMarkdownToHtml(incident.recoveryPlanText);
  };

  const getIncidentReportHtml = () => {
    if (!isDescriptionJson) return '';

    let tableHtml = '';
    if (parsedDescJson.thietHaiTaiSan && parsedDescJson.thietHaiTaiSan.startsWith('[')) {
      try {
        const items = JSON.parse(parsedDescJson.thietHaiTaiSan);
        const total = items.reduce((sum: number, it: any) => sum + (it.chiPhiSoBo || 0), 0);
        tableHtml = `
          <table style="width:100%;border-collapse:collapse;margin:8px 0 10px 0;font-size:12pt;">
            <thead>
              <tr style="background-color:#f2f2f2;">
                <th style="border:1px solid #000;padding:5px 8px;width:45px;text-align:center;font-weight:bold;">STT</th>
                <th style="border:1px solid #000;padding:5px 8px;text-align:left;font-weight:bold;">Tên vật liệu / tài sản hỏng</th>
                <th style="border:1px solid #000;padding:5px 8px;width:160px;text-align:right;font-weight:bold;">Ước tính chi phí sơ bộ (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((it: any, idx: number) => `
                <tr>
                  <td style="border:1px solid #000;padding:5px 8px;text-align:center;">${idx + 1}</td>
                  <td style="border:1px solid #000;padding:5px 8px;">${it.tenVatLieu || ''}</td>
                  <td style="border:1px solid #000;padding:5px 8px;text-align:right;">${it.chiPhiSoBo ? it.chiPhiSoBo.toLocaleString('vi-VN') : '0'}</td>
                </tr>
              `).join('')}
              <tr style="font-weight:bold;">
                <td colspan="2" style="border:1px solid #000;padding:5px 8px;text-align:right;font-weight:bold;">Tổng thiệt hại:</td>
                <td style="border:1px solid #000;padding:5px 8px;text-align:right;color:red;font-weight:bold;">${total.toLocaleString('vi-VN')} VNĐ</td>
              </tr>
            </tbody>
          </table>
        `;
      } catch (e) {
        console.error(e);
      }
    } else {
      tableHtml = `
        <p style="margin:4px 0;">- Tài sản/Vật tư: <strong>${parsedDescJson.thietHaiTaiSan || '.......................................'}</strong></p>
      `;
    }

    const today = new Date();
    const dateStr = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    return `
      <div style="font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.5;color:#000;width:100%;">

        <!-- TIÊU ĐỀ ĐÔI -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
          <tr>
            <td style="width:45%;text-align:center;vertical-align:top;font-size:12pt;font-family:'Times New Roman',Times,serif;border:none;padding:0;">
              <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br/>
              Ban Quản lý Dự án: ${incident.projectName || parsedDescJson.congTrinh || 'Dự án BPG'}<br/>
              <span style="display:inline-block;width:120px;border-bottom:1px solid #000;margin-top:4px;">&nbsp;</span>
            </td>
            <td style="width:55%;text-align:center;vertical-align:top;font-size:12pt;font-family:'Times New Roman',Times,serif;border:none;padding:0;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
              <span style="display:inline-block;width:180px;border-bottom:1px solid #000;margin-top:4px;">&nbsp;</span><br/>
              <em style="font-size:11pt;">${dateStr}</em>
            </td>
          </tr>
        </table>

        <!-- TIÊU ĐỀ BIÊN BẢN -->
        <p style="text-align:center;font-weight:bold;font-size:15pt;margin:20px 0 15px 0;text-transform:uppercase;font-family:'Times New Roman',Times,serif;">
          BIÊN BẢN BÁO CÁO SỰ CỐ CÔNG TRÌNH
        </p>

        <!-- I. THÔNG TIN CHUNG -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>I. THÔNG TIN CHUNG</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Dự án: <strong>${incident.projectName || parsedDescJson.congTrinh || '.......................................'}</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Hạng mục: <strong>${parsedDescJson.hangMuc || '.......................................'}</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Người báo cáo: <strong>${incident.reporterName || '.......................................'}</strong> &nbsp;&nbsp;&nbsp; Chức vụ: <strong>${(parsedDescJson.chucVu || 'Trưởng nhóm').replace(/\s*\(Project Leader\)/gi, '')}</strong></p>

        <!-- II. THÔNG TIN SỰ CỐ -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>II. THÔNG TIN SỰ CỐ</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Thời gian xảy ra: <strong>${parsedDescJson.thoiGianXayRa || '.......................................'}</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Địa điểm: <strong>${parsedDescJson.diaDiem || '.......................................'}</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Loại sự cố: <strong>${parsedDescJson.loaiSuCo || '.......................................'}</strong> &nbsp;&nbsp;&nbsp; Mức độ: <strong>${parsedDescJson.mucDo || 'Khẩn cấp'}</strong></p>

        <!-- III. MÔ TẢ SỰ CỐ -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>III. MÔ TẢ SỰ CỐ</strong></p>
        <p style="margin:3px 0 12px 15px;font-size:12pt;text-align:justify;line-height:1.6;">
          ${parsedDescJson.moTaSuCo || '.......................................................................................................................'}
        </p>

        <!-- IV. THIỆT HẠI -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>IV. THIỆT HẠI</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Con người: <strong>${parsedDescJson.thietHaiConNguoi || 'Không có'}</strong></p>
        <p style="margin:3px 0 3px 15px;font-size:12pt;">- Tiến độ: <strong>${parsedDescJson.thietHaiTienDo || '.......................................'}</strong></p>
        <div style="margin:6px 0 10px 0;">${tableHtml}</div>

        <!-- V. NGUYÊN NHÂN BAN ĐẦU -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>V. NGUYÊN NHÂN BAN ĐẦU</strong></p>
        <p style="margin:3px 0 12px 15px;font-size:12pt;text-align:justify;line-height:1.6;">
          ${parsedDescJson.nguyenNhanBanDau || '.......................................................................................................................'}
        </p>

        <!-- VI. BIỆN PHÁP KHẮC PHỤC -->
        <p style="margin:12px 0 4px 0;font-size:12pt;"><strong>VI. BIỆN PHÁP KHẮC PHỤC KHẨN CẤP ĐÃ THỰC HIỆN</strong></p>
        <p style="margin:3px 0 12px 15px;font-size:12pt;text-align:justify;line-height:1.6;">
          ${parsedDescJson.bienPhapKhanCap || '.......................................................................................................................'}
        </p>

        <!-- CHỮ KÝ -->
        <table style="width:100%;border-collapse:collapse;margin-top:40px;border:none;">
          <tr>
            <td style="text-align:center;width:25%;border:none;font-size:12pt;vertical-align:top;padding:0 4px;">
              <strong>Người lập</strong><br/>
              <em style="font-size:10pt;">(Ký, ghi rõ họ tên)</em>
              <div style="height:55px;"></div>
              <strong>${incident.reporterName || '.......................'}</strong>
            </td>
            <td style="text-align:center;width:25%;border:none;font-size:12pt;vertical-align:top;padding:0 4px;">
              <strong>TPKT</strong><br/>
              <em style="font-size:10pt;">(Ký, ghi rõ họ tên)</em>
              <div style="height:55px;"></div>
              <strong>${incident.status !== 'WaitingStopApproval' && incident.reviewerName ? incident.reviewerName : '.......................'}</strong>
            </td>
            <td style="text-align:center;width:25%;border:none;font-size:12pt;vertical-align:top;padding:0 4px;">
              <strong>Ban QLDA</strong><br/>
              <em style="font-size:10pt;">(Ký, ghi rõ họ tên)</em>
              <div style="height:55px;"></div>
              <strong>.......................<br/></strong>
            </td>
            <td style="text-align:center;width:25%;border:none;font-size:12pt;vertical-align:top;padding:0 4px;">
              <strong>Chủ đầu tư</strong><br/>
              <em style="font-size:10pt;">(Ký, ghi rõ họ tên)</em>
              <div style="height:55px;"></div>
              <strong>.......................<br/></strong>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  const handleExportReportPdf = () => {
    const reportHtml = getIncidentReportHtml();
    if (!reportHtml) return;
    const printContent = `
      <html>
      <head>
        <title>Biên bản báo cáo sự cố công trình - Sự cố #${incident.id}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000;
            background: #fff;
            padding: 0;
            margin: 0;
          }
        </style>
      </head>
      <body>
        ${reportHtml}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      toast.error('Vui lòng cho phép trình duyệt mở popup để in.');
    }
  };

  const handleExportReportWord = () => {
    const reportHtml = getIncidentReportHtml();
    if (!reportHtml) return;
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>Biên bản báo cáo sự cố công trình - Sự cố #${incident.id}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page WordSection1 {
            size: 21cm 29.7cm;
            margin: 2.5cm 2cm 2.5cm 3cm;
            mso-header-margin: 1cm;
            mso-footer-margin: 1cm;
          }
          div.WordSection1 { page: WordSection1; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 0;
            padding: 0;
          }
          table { border-collapse: collapse; }
          td, th { vertical-align: top; }
          p { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          ${reportHtml}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bien_Ban_Bao_Cao_Su_Co_${incident.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const handleExportPdf = () => {
    if (!incident.recoveryPlanText) return;
    const bodyHtml = getDocumentBodyHtml();
    const printContent = `
      <html>
      <head>
        <title>Báo cáo khắc phục thiệt hại - Sự cố #${incident.id}</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: 'Times New Roman', Times, serif, Arial;
            font-size: 13pt;
            line-height: 1.6;
            color: #000;
            background: #fff;
            padding: 0;
            margin: 0;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .header-table td {
            border: none;
            vertical-align: top;
            font-size: 11pt;
            line-height: 1.4;
          }
          .title {
            text-align: center;
            font-weight: bold;
            font-size: 16pt;
            margin-top: 30px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .subtitle {
            text-align: center;
            font-style: italic;
            font-size: 11pt;
            margin-bottom: 30px;
          }
          p, li {
            margin: 0 0 10px 0;
            text-align: justify;
          }
          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 60px;
            page-break-inside: avoid;
          }
          .signature-table td {
            border: none;
            text-align: center;
            width: 33%;
            font-size: 11pt;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
          }
          .signature-space {
            height: 80px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: center; width: 45%; border: none; font-size: 11pt; line-height: 1.4; font-family: 'Times New Roman'; vertical-align: top;">
              <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br/>
              Ban Quản lý Dự án: ${incident.projectName || 'Dự án BPG'}<br/>
              <table align="center" style="width: 100px; border-collapse: collapse; border: none; margin-top: 3px;">
                <tr><td style="border-top: 1px solid black; line-height: 1px; font-size: 1px; height: 1px;">&nbsp;</td></tr>
              </table>
            </td>
            <td style="text-align: center; width: 55%; border: none; font-size: 11pt; line-height: 1.4; font-family: 'Times New Roman'; vertical-align: top;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
              <table align="center" style="width: 150px; border-collapse: collapse; border: none; margin-top: 3px; margin-bottom: 6px;">
                <tr><td style="border-top: 1px solid black; line-height: 1px; font-size: 1px; height: 1px;">&nbsp;</td></tr>
              </table>
              <span style="font-style: italic; font-size: 11pt; display: block; text-align: center;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
            </td>
          </tr>
        </table>
        
        <div class="title">BÁO CÁO KHẮC PHỤC THIỆT HẠI & PHƯƠNG ÁN KHẮC PHỤC SỰ CỐ</div>
        <div class="subtitle">(Mẫu báo cáo tiêu chuẩn hệ thống CMS)</div>
        
        <div style="margin-bottom: 25px; font-size: 12pt;">
          <strong>Dự án:</strong> ${incident.projectName || 'Không xác định'}<br/>
          <strong>Người lập báo cáo:</strong> ${incident.reviewerName || 'Trưởng phòng Kỹ thuật'}<br/>
          <strong>Tổng kinh phí dự kiến:</strong> ${incident.recoveryEstimateCost ? incident.recoveryEstimateCost.toLocaleString('vi-VN') + ' VNĐ' : 'Chưa xác định'}
        </div>
        
        <hr style="border: 0.5px solid #000; margin-bottom: 25px;"/>
        
        <div>
          ${bodyHtml}
        </div>
        
        <div style="text-align: center; font-weight: bold; font-size: 12pt; margin-top: 50px; margin-bottom: 20px; page-break-inside: avoid; text-transform: uppercase;">
          ĐẠI DIỆN CÁC BÊN THAM GIA LẬP BIÊN BẢN
        </div>
        <table class="signature-table">
          <tr>
            <td>
              <span class="signature-title">Đại diện chủ đầu tư</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện nhà thầu thi công</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>${incident.reviewerName || 'Lê Minh Tuấn'}</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện tư vấn giám sát (nếu có)</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
          </tr>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      toast.error('Vui lòng cho phép trình duyệt mở popup để in.');
    }
  };

  const handleExportWord = () => {
    if (!incident.recoveryPlanText) return;
    const bodyHtml = getDocumentBodyHtml();
    const fullHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <title>Báo cáo khắc phục thiệt hại - Sự cố #${incident.id}</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 13pt;
            line-height: 1.5;
            margin: 1in;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .header-table td {
            border: none;
            vertical-align: top;
            font-size: 11pt;
            line-height: 1.3;
          }
          .title {
            text-align: center;
            font-weight: bold;
            font-size: 16pt;
            margin-top: 30px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .subtitle {
            text-align: center;
            font-style: italic;
            font-size: 12pt;
            margin-bottom: 30px;
          }
          h1, h2, h3 {
            font-family: 'Times New Roman', Times, serif;
            margin-top: 15px;
            margin-bottom: 5px;
            font-weight: bold;
          }
          h1 { font-size: 14pt; text-transform: uppercase; }
          h2 { font-size: 13pt; }
          h3 { font-size: 12pt; }
          p, li {
            margin: 0 0 8px 0;
            text-align: left;
          }
          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 50px;
          }
          .signature-table td {
            border: none;
            text-align: center;
            width: 33%;
            font-size: 11pt;
            vertical-align: top;
          }
          .signature-title {
            font-weight: bold;
          }
          .signature-space {
            height: 80px;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td style="text-align: center; width: 45%; border: none; font-size: 11pt; line-height: 1.4; font-family: 'Times New Roman'; vertical-align: top;">
              <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br/>
              Ban Quản lý Dự án: ${incident.projectName || 'Dự án BPG'}<br/>
              <table align="center" style="width: 100px; border-collapse: collapse; border: none; margin-top: 3px;">
                <tr><td style="border-top: 1px solid black; line-height: 1px; font-size: 1px; height: 1px;">&nbsp;</td></tr>
              </table>
            </td>
            <td style="text-align: center; width: 55%; border: none; font-size: 11pt; line-height: 1.4; font-family: 'Times New Roman'; vertical-align: top;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br/>
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br/>
              <table align="center" style="width: 150px; border-collapse: collapse; border: none; margin-top: 3px; margin-bottom: 6px;">
                <tr><td style="border-top: 1px solid black; line-height: 1px; font-size: 1px; height: 1px;">&nbsp;</td></tr>
              </table>
              <span style="font-style: italic; font-size: 11pt; display: block; text-align: center;">Ngày ${new Date().getDate()} tháng ${new Date().getMonth() + 1} năm ${new Date().getFullYear()}</span>
            </td>
          </tr>
        </table>
        
        <div class="title">BÁO CÁO KHẮC PHỤC THIỆT HẠI & PHƯƠNG ÁN KHẮC PHỤC SỰ CỐ</div>
        <div class="subtitle">(Mẫu báo cáo tiêu chuẩn hệ thống CMS)</div>
        
        <div style="margin-bottom: 20px;">
          <strong>Dự án:</strong> ${incident.projectName || 'Không xác định'}<br/>
          <strong>Người lập báo cáo:</strong> ${incident.reviewerName || 'Trưởng phòng Kỹ thuật'}<br/>
          <strong>Tổng kinh phí dự kiến:</strong> ${incident.recoveryEstimateCost ? incident.recoveryEstimateCost.toLocaleString('vi-VN') + ' VNĐ' : 'Chưa xác định'}
        </div>
        
        <hr style="border: 0.5px solid #000; margin-bottom: 20px;"/>
        
        <div>
          ${bodyHtml}
        </div>
        
        <div style="text-align: center; font-weight: bold; font-size: 12pt; margin-top: 40px; margin-bottom: 20px; text-transform: uppercase;">
          ĐẠI DIỆN CÁC BÊN THAM GIA LẬP BIÊN BẢN
        </div>
        <table class="signature-table">
          <tr>
            <td>
              <span class="signature-title">Đại diện chủ đầu tư</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện nhà thầu thi công</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>${incident.reviewerName || 'Lê Minh Tuấn'}</strong>
            </td>
            <td>
              <span class="signature-title">Đại diện tư vấn giám sát (nếu có)</span><br/>
              <span style="font-style: italic; font-size: 10pt;">(Họ tên, chữ ký)</span>
              <div class="signature-space"></div>
              <strong>.......................................</strong>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bao_cao_khac_phuc_thiet_hai_Incident_${incident.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !incident) return null;

  let parsedDoc: any = null;
  if (incident.recoveryPlanText && incident.recoveryPlanText.startsWith('{')) {
    try {
      parsedDoc = JSON.parse(incident.recoveryPlanText);
    } catch (e) {
      console.error('Error parsing recovery plan text', e);
    }
  }

  const incidentType = incident.incidentType as keyof typeof INCIDENT_META;
  const meta = INCIDENT_META[incidentType] ?? INCIDENT_META.Construction;
  const TypeIcon = meta.icon;
  const isInventoryIncident = incidentType === 'InventoryLoss' || incidentType === 'InventoryDamage';
  const isConstruction = !isInventoryIncident;

  // Check if description is JSON
  let isDescriptionJson = false;
  let parsedDescJson: any = null;
  if (incident.description && incident.description.startsWith('{')) {
    try {
      parsedDescJson = JSON.parse(incident.description);
      isDescriptionJson = true;
    } catch (e) {
      console.error('Error parsing description JSON', e);
    }
  }

  // Extract images from description (they were embedded as ![alt](url))
  const imageLines = isDescriptionJson ? [] : (incident.description || '').split('\n').filter(l => l.startsWith('!['));
  const descWithoutImages = isDescriptionJson ? '' : incident.description?.split('\n').filter(l => !l.startsWith('![')).join('\n').trim();
  const { mainDesc: mainDescClean, meta: descMetaClean } = extractMetaFromDesc(descWithoutImages || '');

  // Do the same for damageDescription
  const { mainDesc: damageDescClean, meta: damageMetaClean } = extractMetaFromDesc(isDescriptionJson ? (parsedDescJson.thietHaiTaiSan || '') : (incident.damageDescription || ''));

  interface DamagedItem {
    code: string;
    name: string;
    unit: string;
    quantityLost: number;
  }
  const parsedDamagedItems: DamagedItem[] = [];
  if (isInventoryIncident && incident.damageDescription) {
    const lines = incident.damageDescription.split('\n');
    lines.forEach(line => {
      if (line.trim().startsWith('|') && !line.includes('Mã vật tư') && !line.includes('---')) {
        const parts = line.split('|').map(p => p.trim());
        if (parts.length >= 5) {
          const code = parts[1];
          const name = parts[2];
          const unit = parts[3];
          const qtyStr = parts[4].replace(/\*\*/g, '');
          const qty = parseFloat(qtyStr) || 0;
          if (code && name) {
            parsedDamagedItems.push({ code, name, unit, quantityLost: qty });
          }
        }
      }
    });
  }

  const extractedImages = imageLines.map(l => {
    const match = l.match(/!\[.*?\]\((.*?)\)/);
    return match ? match[1] : null;
  }).filter(Boolean) as string[];
  const displayImages = (incident.images && incident.images.length > 0)
    ? incident.images
    : (isDescriptionJson ? (parsedDescJson?.imageUrls || []) : extractedImages);

  const statusColor = {
    WaitingReview: { label: 'Chờ TPKT Thẩm định', color: 'hsl(38, 92%, 50%)', bg: 'hsl(38, 100%, 96%)' },
    WaitingAccountant: { label: 'Chờ Kế toán Xác minh', color: 'hsl(210, 70%, 45%)', bg: 'hsl(210, 100%, 97%)' },
    WaitingDirector: { label: 'Chờ Giám đốc Phê duyệt', color: 'hsl(280, 70%, 45%)', bg: 'hsl(280, 100%, 97%)' },
    WaitingStopApproval: { label: 'Chờ Duyệt Dừng Thi Công', color: 'hsl(0, 92%, 50%)', bg: 'hsl(0, 100%, 96%)' },
    WaitingRecoveryPlan: { label: 'Chờ Lập Kế Hoạch', color: 'hsl(280, 70%, 45%)', bg: 'hsl(280, 100%, 97%)' },
    WaitingDirectorApproval: { label: 'Chờ Giám Đốc Duyệt', color: 'hsl(142, 71%, 40%)', bg: 'hsl(142, 100%, 97%)' },
    Assessing: { label: 'Cần Bổ sung', color: 'hsl(0, 72%, 50%)', bg: 'hsl(0, 100%, 97%)' },
    Approved: {
      label: 'Đã Duyệt',
      color: 'hsl(142, 71%, 40%)',
      bg: 'hsl(142, 100%, 97%)'
    },
    Rejected: { label: 'Bị Từ chối', color: 'hsl(0, 72%, 50%)', bg: 'hsl(0, 100%, 97%)' },
    Resolved: { label: 'Đã xử lý', color: 'hsl(var(--text-secondary))', bg: 'hsl(var(--bg-muted))' },
  }[incident.status as string] ?? { label: incident.status, color: 'hsl(var(--text-secondary))', bg: 'hsl(var(--bg-muted))' };

  const isTPKT = user?.role === 'technicalmanager';
  const isAccountant = user?.role === 'accountant';
  const isDirector = user?.role === 'director';

  const incidentDetailsJSX = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Phase info */}
      {phase && (
        <div style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-muted))', padding: '8px 12px', borderRadius: '6px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <BarChart3 size={13} />
          <span>Phase: <strong>{phase.name}</strong> · Hạn: <strong style={{ color: 'hsl(var(--primary))' }}>{phase.deadline || 'Không có'}</strong></span>
        </div>
      )}

      {/* Progress tracker */}
      {incident.isEmergency ? (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-muted))', borderRadius: '10px', border: '1px solid hsl(var(--border))' }}>
          {[
            { n: 1, label: 'PL Báo cáo dừng', done: true },
            { n: 2, label: 'TPKT Duyệt dừng', done: incident.status !== 'WaitingStopApproval' },
            { n: 3, label: 'Lập báo cáo khắc phục', done: incident.status !== 'WaitingStopApproval' && incident.status !== 'WaitingRecoveryPlan' },
            { n: 4, label: 'Giám đốc phê duyệt', done: incident.status === 'Approved' },
          ].map((step, idx) => (
            <React.Fragment key={step.n}>
              {idx > 0 && <ArrowRight size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'hsl(var(--success))' : 'hsl(var(--border))',
                  color: step.done ? '#fff' : 'hsl(var(--text-muted))',
                }}>
                  {step.n}
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', color: step.done ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: 'hsl(var(--bg-muted))', borderRadius: '10px', border: '1px solid hsl(var(--border))' }}>
          {[
            { n: 1, label: 'PL Báo cáo', done: true },
            { n: 2, label: isInventoryIncident ? 'Kế toán Xác minh' : 'TPKT Thẩm định', done: !!incident.damageDescription },
            { n: 3, label: isInventoryIncident ? 'Chuyển sang Giám đốc' : 'Hoàn tất', done: incident.status === 'Approved' },
          ].map((step, idx) => (
            <React.Fragment key={step.n}>
              {idx > 0 && <ArrowRight size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                <div style={{
                  width: '26px', height: '26px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'hsl(var(--success))' : 'hsl(var(--border))',
                  color: step.done ? '#fff' : 'hsl(var(--text-muted))',
                }}>
                  {step.n}
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, textAlign: 'center', color: step.done ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Revision notice */}
      {(incident.status === 'Assessing' || incident.status === 'Rejected') && incident.handlingInstruction && (
        <div style={{ padding: '12px', background: 'hsl(var(--danger-glow))', border: '1px solid hsl(var(--danger) / 0.3)', borderRadius: '8px', display: 'flex', gap: '8px', color: 'hsl(var(--danger))' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ fontSize: '0.85rem' }}>{incident.status === 'Rejected' ? `Lý do từ chối từ ${incident.reviewerName || 'người duyệt'}:` : `Yêu cầu bổ sung từ ${incident.reviewerName || 'người duyệt'}:`}</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{incident.handlingInstruction}</p>
          </div>
        </div>
      )}

      {/* ── BƯỚC 1: Thông tin sự cố ─────────────────────────────── */}
      <div style={{ border: `1px solid ${meta.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: meta.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Bước 1: Báo cáo Sự cố (Trưởng nhóm dự án)
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isDescriptionJson && (
              <>
                <button
                  type="button"
                  onClick={handleExportReportPdf}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'hsl(var(--primary))',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  🖨️ In Báo cáo
                </button>
                <button
                  type="button"
                  onClick={handleExportReportWord}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'hsl(210, 70%, 45%)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📝 Xuất Word
                </button>
              </>
            )}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
              {incident.reporterName} · {incident.date}
            </span>
          </div>
        </div>

        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isDescriptionJson ? (
            <div style={{
              padding: '20px 24px',
              background: '#fff',
              color: '#000',
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: '1.05rem',
              lineHeight: '1.6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '0.85rem', lineHeight: '1.4', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                <div style={{ textAlign: 'center', width: '45%' }}>
                  <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br />
                  Ban Quản lý Dự án: {incident.projectName || 'Dự án BPG'}<br />
                  ---
                </div>
                <div style={{ textAlign: 'center', width: '50%' }}>
                  <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br />
                  <strong>Độc lập - Tự do - Hạnh phúc</strong><br />
                  ---
                </div>
              </div>

              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.3rem', margin: '20px 0 15px 0', textTransform: 'uppercase' }}>
                BIÊN BẢN BÁO CÁO SỰ CỐ CÔNG TRÌNH
              </div>

              <div style={{ textAlign: 'justify' }}>
                <p><strong>I. THÔNG TIN CHUNG</strong></p>
                <div style={{ paddingLeft: '14px', marginBottom: '10px' }}>
                  <p style={{ margin: '4px 0' }}>- Dự án: <strong>{incident.projectName || '.......................................'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Công trình: <strong>{parsedDescJson.congTrinh || '.......................................'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Hạng mục: <strong>{parsedDescJson.hangMuc || '.......................................'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Người báo cáo: <strong>{incident.reporterName || '.......................................'}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Chức vụ: <strong>{(parsedDescJson.chucVu || 'Trưởng nhóm').replace(/\s*\(Project Leader\)/gi, '')}</strong></p>
                </div>

                <p><strong>II. THÔNG TIN SỰ CỐ</strong></p>
                <div style={{ paddingLeft: '14px', marginBottom: '10px' }}>
                  <p style={{ margin: '4px 0' }}>- Thời gian xảy ra: <strong>{parsedDescJson.thoiGianXayRa || '.......................................'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Địa điểm: <strong>{parsedDescJson.diaDiem || '.......................................'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Loại sự cố: <strong>{parsedDescJson.loaiSuCo || '.......................................'}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Mức độ: <strong>{parsedDescJson.mucDo || 'Khẩn cấp'}</strong></p>
                </div>

                <p><strong>III. MÔ TẢ SỰ CỐ</strong></p>
                <div style={{ paddingLeft: '14px', whiteSpace: 'pre-wrap', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '10px', marginBottom: '10px' }}>
                  {parsedDescJson.moTaSuCo}
                </div>

                <p><strong>IV. THIỆT HẠI</strong></p>
                <div style={{ paddingLeft: '14px', marginBottom: '10px' }}>
                  <p style={{ margin: '4px 0' }}>- Con người: <strong>{parsedDescJson.thietHaiConNguoi || 'Không có'}</strong></p>
                  <p style={{ margin: '4px 0' }}>- Tiến độ: <strong>{parsedDescJson.thietHaiTienDo || '.......................................'}</strong></p>
                  {parsedDescJson.thietHaiTaiSan && parsedDescJson.thietHaiTaiSan.startsWith('[') ? (
                    (() => {
                      try {
                        const items = JSON.parse(parsedDescJson.thietHaiTaiSan);
                        const total = items.reduce((sum: number, it: any) => sum + (it.chiPhiSoBo || 0), 0);
                        return (
                          <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                            <p style={{ margin: '4px 0' }}>- Chi tiết thiệt hại vật tư & chi phí ước tính sơ bộ:</p>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.85rem', marginTop: '4px' }}>
                              <thead>
                                <tr style={{ background: '#f2f2f2' }}>
                                  <th style={{ border: '1px solid #000', padding: '6px', width: '50px', textAlign: 'center' }}>STT</th>
                                  <th style={{ border: '1px solid #000', padding: '6px', textAlign: 'left' }}>Tên vật liệu / tài sản hỏng</th>
                                  <th style={{ border: '1px solid #000', padding: '6px', width: '180px', textAlign: 'right' }}>Ước tính chi phí sơ bộ (VNĐ)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((it: any, idx: number) => (
                                  <tr key={idx}>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{it.stt}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px' }}>{it.tenVatLieu}</td>
                                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>{it.chiPhiSoBo ? it.chiPhiSoBo.toLocaleString('vi-VN') : '0'}</td>
                                  </tr>
                                ))}
                                <tr style={{ fontWeight: 'bold', background: '#f9f9f9' }}>
                                  <td colSpan={2} style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>Tổng thiệt hại:</td>
                                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right', color: 'red' }}>{total.toLocaleString('vi-VN')} VNĐ</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        );
                      } catch (e) {
                        console.error(e);
                      }
                      return null;
                    })()
                  ) : (
                    <>
                      <p style={{ margin: '4px 0' }}>- Tài sản/Vật tư: <strong>{parsedDescJson.thietHaiTaiSan || '.......................................'}</strong></p>

                    </>
                  )}
                </div>

                <p><strong>V. NGUYÊN NHÂN BAN ĐẦU</strong></p>
                <div style={{ paddingLeft: '14px', whiteSpace: 'pre-wrap', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '10px', marginBottom: '10px' }}>
                  {parsedDescJson.nguyenNhanBanDau}
                </div>

                <p><strong>VI. BIỆN PHÁP KHẨN CẤP ĐÃ THỰC HIỆN</strong></p>
                <div style={{ paddingLeft: '14px', whiteSpace: 'pre-wrap', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '10px' }}>
                  {parsedDescJson.bienPhapKhanCap}
                </div>
              </div>

            </div>
          ) : (
            <>
              {/* Project & Task info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '6px', borderBottom: '1px dashed hsl(var(--border))' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Dự án</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: '0.9rem', color: 'hsl(var(--primary))' }}>
                    {incident.projectName || `Dự án #${incident.projectId}`}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Công việc / Giai đoạn</span>
                  <p style={{ margin: '2px 0 0', fontWeight: 600, fontSize: '0.9rem' }}>
                    {isInventoryIncident ? (incident.phaseName || 'Không xác định') : (incident.taskName || 'Không xác định')}
                  </p>
                </div>
              </div>

              {/* Meta info grid (extracted from description) */}
              {Object.keys(descMetaClean).length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  {Object.entries(descMetaClean).map(([key, val]) => {
                    const icons: Record<string, React.ReactNode> = {
                      'Vị trí chi tiết': <MapPin size={12} />,
                      'Vị trí kho/Lô hàng': <MapPin size={12} />,
                      'Ngày/Giờ xảy ra': <Clock size={12} />,
                      'Ngày/Giờ phát hiện': <Clock size={12} />,
                      'Người chịu trách nhiệm': <Users size={12} />,
                      'Người làm chứng/Liên đới': <Users size={12} />,
                    };
                    return (
                      <div key={key} style={{ padding: '8px 10px', background: 'hsl(var(--bg-muted))', borderRadius: '6px', borderLeft: `3px solid ${meta.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '3px' }}>
                          {icons[key] ?? null}
                          {key}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{val}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Main description */}
              {mainDescClean && (
                <div style={{ marginTop: '2px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Mô tả diễn biến sự cố</span>
                  <div style={{ marginTop: '2px', color: 'hsl(var(--text-primary))', fontSize: '0.85rem' }} className="[&>p:last-child]:mb-0 [&>p]:mt-1">
                    <MiniMarkdown content={mainDescClean} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Images */}
          {displayImages.length > 0 && (
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Hình ảnh đính kèm</span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: displayImages.length === 1 ? '1fr' : displayImages.length === 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '10px'
              }}>
                {displayImages.map((img: string, idx: number) => (
                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%' }}>
                    <img src={img} alt={`Ảnh ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: displayImages.length === 1 ? 'auto' : displayImages.length === 2 ? '240px' : '160px',
                        maxHeight: displayImages.length === 1 ? '400px' : 'none',
                        objectFit: displayImages.length === 1 ? 'contain' : 'cover',
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'hsl(var(--bg-main))'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BƯỚC 2: Đánh giá thiệt hại ───────────────────────────── */}
      {incident.damageDescription && (
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-muted))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bước 2: {isInventoryIncident ? 'Thống kê Vật tư Thiệt hại' : 'Đánh giá Thiệt hại & Vật tư Cấp bù'}
            </span>
          </div>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Unified Stats & Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
              {isConstruction && incident.isEmergency && (
                <div style={{ padding: '10px 12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>

                  <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>
                    {incident.estimatedMaterialLoss ? incident.estimatedMaterialLoss.toLocaleString('vi-VN') + ' VNĐ' : 'Chưa xác định'}
                  </strong>
                </div>
              )}

              {Object.entries(damageMetaClean).map(([key, val]) => (
                <div key={key} style={{ padding: '10px 12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} />
                    {key}
                  </div>
                  <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--text-primary))' }}>{val}</strong>
                </div>
              ))}

              {isConstruction && incident.proposedAction && (
                <div style={{ padding: '10px 12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))', gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={12} />Đề xuất xử lý</div>
                  <strong style={{ fontSize: '0.95rem', color: 'hsl(var(--primary))' }}>{incident.proposedAction}</strong>
                </div>
              )}
            </div>

            {/* Table for Inventory Incidents */}
            {isInventoryIncident && parsedDamagedItems.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                  Bảng thống kê vật tư thiệt hại
                </span>
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid hsl(var(--border))' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'hsl(var(--bg-muted))', textAlign: 'left', borderBottom: '1px solid hsl(var(--border))' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Mã VT</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Tên vật tư</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>Tồn kho ban đầu</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'center' }}>SL Lỗi/Mất</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Tồn kho sau trừ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedDamagedItems.map((it, idx) => {
                        const invItem = inventory.find(inv => inv.materialCode === it.code);
                        const hasInv = !!invItem;

                        let stockBeforeStr = '-';
                        let stockAfterStr = '-';

                        if (hasInv) {
                          const isAlreadyDecreased = incident.status === 'Approved';
                          const stockBeforeVal = isAlreadyDecreased ? invItem.quantity + it.quantityLost : invItem.quantity;
                          const stockAfterVal = isAlreadyDecreased ? invItem.quantity : invItem.quantity - it.quantityLost;

                          stockBeforeStr = `${stockBeforeVal} ${it.unit}`;
                          stockAfterStr = `${stockAfterVal} ${it.unit}`;
                        }

                        return (
                          <tr key={idx} style={{ borderBottom: idx < parsedDamagedItems.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                            <td style={{ padding: '8px 12px', color: 'hsl(var(--text-primary))' }}>{it.code}</td>
                            <td style={{ padding: '8px 12px', color: 'hsl(var(--text-primary))' }}>{it.name}</td>
                            <td style={{ padding: '8px 12px', color: 'hsl(var(--text-primary))', textAlign: 'center' }}>{stockBeforeStr}</td>
                            <td style={{ padding: '8px 12px', color: 'red', fontWeight: 600, textAlign: 'center' }}>
                              -{it.quantityLost} {it.unit}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'hsl(var(--text-primary))', fontWeight: 700, textAlign: 'right' }}>{stockAfterStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Damage description as Markdown (only for construction incidents or if there is extra text) */}
            {damageDescClean && !isInventoryIncident && (
              <div style={{ marginTop: '2px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                  {damageDescClean.startsWith('[') ? 'Danh sách tài sản/vật tư bị thiệt hại' : 'Ghi chú thiệt hại bổ sung'}
                </span>
                <div style={{ color: 'hsl(var(--text-primary))', fontSize: '0.85rem' }} className="[&>p:last-child]:mb-0 [&>p]:mt-1">
                  {damageDescClean.startsWith('[') ? (
                    (() => {
                      try {
                        const items = JSON.parse(damageDescClean);
                        const total = items.reduce((sum: number, it: any) => sum + (it.chiPhiSoBo || 0), 0);
                        return (
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid hsl(var(--border))', fontSize: '0.8rem', marginTop: '6px', borderRadius: '6px', overflow: 'hidden' }}>
                            <thead>
                              <tr style={{ background: 'hsl(var(--bg-muted))', textAlign: 'left', borderBottom: '1px solid hsl(var(--border))' }}>
                                <th style={{ padding: '6px 10px', width: '50px', textAlign: 'center', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>STT</th>
                                <th style={{ padding: '6px 10px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Tên vật liệu / tài sản hỏng</th>
                                <th style={{ padding: '6px 10px', width: '180px', textAlign: 'right', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Ước tính chi phí sơ bộ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                                  <td style={{ padding: '6px 10px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>{it.stt}</td>
                                  <td style={{ padding: '6px 10px', color: 'hsl(var(--text-primary))' }}>{it.tenVatLieu}</td>
                                  <td style={{ padding: '6px 10px', textAlign: 'right', color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{it.chiPhiSoBo ? it.chiPhiSoBo.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ'}</td>
                                </tr>
                              ))}
                              <tr style={{ background: 'hsl(var(--bg-muted))', fontWeight: 700 }}>
                                <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', color: 'hsl(var(--text-secondary))' }}>Tổng thiệt hại:</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: 'red' }}>{total.toLocaleString('vi-VN')} VNĐ</td>
                              </tr>
                            </tbody>
                          </table>
                        );
                      } catch (e) {
                        console.error(e);
                      }
                      return <MiniMarkdown content={damageDescClean} />;
                    })()
                  ) : (
                    <MiniMarkdown content={damageDescClean} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BƯỚC THÊM: Báo cáo khắc phục (báo cáo.md) ─────────────────────────── */}
      {incident.recoveryPlanText && (isTPKT || isDirector) && (
        <div style={{ border: '1px solid hsl(var(--primary) / 0.4)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'hsl(var(--primary-glow))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--primary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Hồ sơ Báo cáo &amp; Kế hoạch Khắc phục Thiệt hại
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {incident.recoveryEstimateCost !== undefined && incident.recoveryEstimateCost !== null && (
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--primary))', marginRight: '8px' }}>
                  Tổng dự toán: {incident.recoveryEstimateCost.toLocaleString('vi-VN')} VNĐ
                </span>
              )}
              {parsedDoc?.isImported ? (
                parsedDoc.files && parsedDoc.files.length > 0 ? (
                  <a
                    href={parsedDoc.files[0].fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'hsl(210, 70%, 45%)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    📥 Tải tài liệu (${parsedDoc.files.length} tệp)
                  </a>
                ) : (
                  <a
                    href={parsedDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'hsl(210, 70%, 45%)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    📥 Tải kế hoạch Word
                  </a>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'hsl(var(--primary))',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🖨️ Xuất PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleExportWord}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#fff',
                      background: 'hsl(210, 70%, 45%)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📝 Xuất Word
                  </button>
                </>
              )}
            </div>
          </div>

          {parsedDoc ? (
            parsedDoc.isImported ? (
              <div style={{ padding: '30px 40px', background: '#fff', borderTop: '1px solid hsl(var(--border))', color: '#000', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', color: '#2b6cb0', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                  <FileText size={48} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px', color: '#2b6cb0' }}>
                  Kế hoạch khắc phục sự cố đã được nhập từ tài liệu đính kèm
                </h3>

                {parsedDoc.files && parsedDoc.files.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '16px' }}>
                    <p style={{ color: '#4a5568', fontSize: '0.9rem', marginBottom: '4px' }}>
                      Danh sách tài liệu đính kèm ({parsedDoc.files.length} tệp):
                    </p>
                    {parsedDoc.files.map((file: any, idx: number) => (
                      <a
                        key={idx}
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: '#3182ce',
                          color: '#fff',
                          padding: '8px 16px',
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          fontSize: '0.85rem',
                          textDecoration: 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          maxWidth: '350px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={file.fileName}
                      >
                        📥 Tải xuống: {file.fileName}
                      </a>
                    ))}
                  </div>
                ) : (
                  <>
                    <p style={{ color: '#4a5568', fontSize: '0.9rem', marginBottom: '20px' }}>
                      Tên file: <strong>{parsedDoc.fileName}</strong>
                    </p>
                    <a
                      href={parsedDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#3182ce',
                        color: '#fff',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        textDecoration: 'none',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      📥 Tải xuống File Kế hoạch (.doc / .docx)
                    </a>
                  </>
                )}

                <div style={{ marginTop: '24px', borderTop: '1px dashed #e2e8f0', paddingTop: '16px', fontSize: '0.8rem', color: '#718096' }}>
                  * Vui lòng tải xuống các tệp tin ở trên để xem xét kỹ nội dung phương án và ngân sách khắc phục.
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 30px', background: '#fff', borderTop: '1px solid hsl(var(--border))', color: '#000', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.05rem', lineHeight: '1.6', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                {parsedDoc.maKeHoach ? (
                  <div style={{ textAlign: 'justify' }}>
                    {/* Official Heading */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '0.85rem', lineHeight: '1.4', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br />
                        Ban Quản lý Dự án: {incident.projectName || 'Dự án BPG'}<br />
                        ---
                      </div>
                      <div style={{ textAlign: 'center', width: '50%' }}>
                        <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br />
                        <strong>Độc lập - Tự do - Hạnh phúc</strong><br />
                        ---
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.3rem', margin: '20px 0 5px 0', textTransform: 'uppercase' }}>
                      KẾ HOẠCH KHẮC PHỤC SỰ CỐ
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '24px' }}>
                      <span>Mã kế hoạch: {parsedDoc.maKeHoach}</span>
                      <span>Liên kết báo cáo: {parsedDoc.lienKetBaoCao}</span>
                    </div>

                    <p style={{ margin: '12px 0 6px 0' }}><strong>1. Mục tiêu khắc phục</strong></p>
                    <div style={{ paddingLeft: '14px', whiteSpace: 'pre-wrap', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '10px', marginBottom: '14px', fontSize: '0.95rem' }}>
                      {parsedDoc.mucTieu}
                    </div>

                    <p style={{ margin: '16px 0 6px 0' }}><strong>2. Kế hoạch thực hiện chi tiết</strong></p>
                    <div style={{ paddingLeft: '0px', marginTop: '6px', marginBottom: '14px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f2f2f2' }}>
                            <th style={{ border: '1px solid #000', padding: '6px', width: '40px', textAlign: 'center' }}>STT</th>
                            <th style={{ border: '1px solid #000', padding: '6px' }}>Công việc</th>
                            <th style={{ border: '1px solid #000', padding: '6px', width: '130px' }}>Người phụ trách</th>
                            <th style={{ border: '1px solid #000', padding: '6px', width: '80px', textAlign: 'center' }}>Thời hạn</th>
                            <th style={{ border: '1px solid #000', padding: '6px' }}>Kết quả</th>
                            <th style={{ border: '1px solid #000', padding: '6px' }}>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedDoc.keHoachThucHien?.map((step: any, idx: number) => (
                            <tr key={idx}>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{step.stt}</td>
                              <td style={{ border: '1px solid #000', padding: '6px' }}>{step.congViec}</td>
                              <td style={{ border: '1px solid #000', padding: '6px' }}>{step.nguoiPhuTrach}</td>
                              <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{step.thoiHan}</td>
                              <td style={{ border: '1px solid #000', padding: '6px' }}>{step.ketQua}</td>
                              <td style={{ border: '1px solid #000', padding: '6px' }}>{step.ghiChu}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p style={{ margin: '16px 0 6px 0' }}><strong>3. Chi phí dự kiến khắc phục</strong></p>
                    <div style={{ paddingLeft: '14px', marginBottom: '14px' }}>
                      - Tổng dự toán chi phí khắc phục: <strong>{incident.recoveryEstimateCost ? incident.recoveryEstimateCost.toLocaleString('vi-VN') + ' VNĐ' : '0 VNĐ'}</strong>
                    </div>

                    <p style={{ margin: '16px 0 6px 0' }}><strong>4. Điều kiện nghiệm thu hoàn thành</strong></p>
                    <div style={{ paddingLeft: '14px', whiteSpace: 'pre-wrap', background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: '4px', padding: '10px' }}>
                      {parsedDoc.dieuKienNghiemThu}
                    </div>

                  </div>
                ) : (
                  <>
                    {/* Official Heading */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '0.85rem', lineHeight: '1.4', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
                      <div style={{ textAlign: 'center', width: '45%' }}>
                        <strong>CÔNG TY CỔ PHẦN XÂY DỰNG BPG</strong><br />
                        Ban Quản lý Dự án: {incident.projectName || 'Dự án CMS'}<br />
                        ---
                      </div>
                      <div style={{ textAlign: 'center', width: '50%' }}>
                        <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br />
                        <strong>Độc lập - Tự do - Hạnh phúc</strong><br />
                        ---
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.3rem', margin: '20px 0 5px 0', textTransform: 'uppercase' }}>
                      BÁO CÁO SỰ CỐ CÔNG TRÌNH XÂY DỰNG
                    </div>
                    <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: '0.9rem', marginBottom: '24px', color: 'hsl(var(--text-muted))' }}>
                      (Lập và lưu trữ trên hệ thống hợp đồng số CMS)
                    </div>

                    <div style={{ textAlign: 'justify' }}>
                      <p style={{ margin: '12px 0 6px 0' }}><strong>1. Thông tin công trình</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Tên công trình: <strong>{parsedDoc.tenCongTrinh || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Địa chỉ công trình: <strong>{parsedDoc.diaChiCongTrinh || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Chủ đầu tư: <strong>{parsedDoc.chuDauTu || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Nhà thầu thi công: <strong>{parsedDoc.nhaThauThiCong || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Đơn vị tư vấn giám sát: <strong>{parsedDoc.donViGiamSat || '.......................................'}</strong></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>2. Thời gian xảy ra sự cố</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Ngày, giờ xảy ra: <strong>{parsedDoc.thoiGianXayRa || '.......................................'}</strong></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>3. Mô tả sự cố</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Loại sự cố: <strong>{parsedDoc.loaiSuCo || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Mô tả chi tiết: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.moTaChiTiet || '.......................................'}</span></p>
                        <p style={{ margin: '4px 0' }}>- Nguyên nhân ban đầu (nếu có): <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.nguyenNhanBanDau || '.......................................'}</span></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>4. Thiệt hại do sự cố (nếu có)</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Thiệt hại về con người: <strong>{parsedDoc.thietHaiConNguoi || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Thiệt hại về vật chất: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.thietHaiVatChat || '.......................................'}</span></p>
                        <p style={{ margin: '4px 0' }}>- Thiệt hại khác: <strong>{parsedDoc.thietHaiKhac || '.......................................'}</strong></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>5. Biện pháp khắc phục ban đầu</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Các hành động đã thực hiện: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.bienPhapDaThucHien || '.......................................'}</span></p>
                        <p style={{ margin: '4px 0' }}>- Đề xuất hướng xử lý tiếp theo: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.deXuatHuongXuLy || '.......................................'}</span></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>6. Các bên liên quan chứng kiến sự cố</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Họ và tên: <strong>{parsedDoc.chungKienHoTen || '.......................................'}</strong></p>
                        <p style={{ margin: '4px 0' }}>- Liên hệ: <strong>{parsedDoc.chungKienLienHe || '.......................................'}</strong></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>7. Ý kiến của các bên</strong></p>
                      <div style={{ paddingLeft: '14px' }}>
                        <p style={{ margin: '4px 0' }}>- Chủ đầu tư: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.yKienChuDauTu || '.......................................'}</span></p>
                        <p style={{ margin: '4px 0' }}>- Nhà thầu thi công: <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.yKienNhaThau || '.......................................'}</span></p>
                        <p style={{ margin: '4px 0' }}>- Tư vấn giám sát (nếu có): <span style={{ fontWeight: 600, display: 'block', paddingLeft: '10px', color: '#333', whiteSpace: 'pre-wrap' }}>{parsedDoc.yKienGiamSat || '.......................................'}</span></p>
                      </div>

                      <p style={{ margin: '16px 0 6px 0' }}><strong>8. Kết luận và cam kết</strong></p>
                      <p style={{ paddingLeft: '14px', margin: '4px 0' }}>Chúng tôi cam kết thông tin trong báo cáo là chính xác và sẽ phối hợp thực hiện các biện pháp khắc phục theo quy định.</p>
                    </div>

                    {/* Signature block preview */}
                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '36px', marginBottom: '16px', textTransform: 'uppercase' }}>
                      ĐẠI DIỆN CÁC BÊN THAM GIA LẬP BIÊN BẢN
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '0.82rem', textAlign: 'center', marginTop: '10px' }}>
                      <div>
                        <strong>Đại diện chủ đầu tư</strong><br />
                        <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                        <div style={{ height: '50px' }}></div>
                        <span>.......................................</span>
                      </div>
                      <div>
                        <strong>Đại diện nhà thầu thi công</strong><br />
                        <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                        <div style={{ height: '50px' }}></div>
                        <strong>{incident.reviewerName || 'Lê Minh Tuấn'}</strong>
                      </div>
                      <div>
                        <strong>Đại diện tư vấn giám sát (nếu có)</strong><br />
                        <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: '#666' }}>(Họ tên, chữ ký)</span>
                        <div style={{ height: '50px' }}></div>
                        <span>.......................................</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          ) : (
            <div style={{ padding: '14px', maxHeight: '350px', overflowY: 'auto', background: 'hsl(var(--bg-card))', borderTop: '1px solid hsl(var(--border))' }}>
              <div style={{ color: 'hsl(var(--text-primary))', fontSize: '0.85rem' }} className="markdown-body">
                <MiniMarkdown content={incident.recoveryPlanText} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BƯỚC 3: Kết quả phê duyệt ────────────────────────────── */}
      {incident.status === 'Approved' && (
        <div style={{ border: '1px solid hsl(var(--success) / 0.4)', borderRadius: '10px', padding: '14px', background: 'hsl(var(--success-glow))', display: 'flex', gap: '10px' }}>
          <CheckCircle size={18} style={{ color: 'hsl(var(--success))', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <span style={{ fontSize: '0.7rem', color: 'hsl(var(--success))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Bước 3: Đã xử lý bởi {incident.reviewerName?.toUpperCase()}
            </span>
            <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'hsl(var(--text-primary))' }}>
              {isInventoryIncident
                ? 'Giám đốc đã phê duyệt phiếu giảm tồn kho liên quan. Sự cố vật tư kho đã được xử lý hoàn tất.'
                : 'Sự cố đã được TPKT thẩm định. Rework Task hoặc điều chỉnh tiến độ đã được áp dụng.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Handling Instruction ─────────────────────────────────────── */}
      {incident.status !== 'Assessing' && incident.status !== 'Rejected' && (isTPKT || isDirector) && (
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'hsl(var(--bg-muted))' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isInventoryIncident ? 'Ghi chú / Hướng dẫn xử lý' : 'Hướng dẫn xử lý'}
            </span>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {incident.handlingInstruction ? (
              <div style={{ padding: '10px', background: 'hsl(var(--bg-card))', borderRadius: '6px', border: '1px solid hsl(var(--border))', fontSize: '0.85rem', color: 'hsl(var(--text-primary))', whiteSpace: 'pre-wrap' }}>
                {incident.handlingInstruction}
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Chưa có hướng dẫn xử lý.</span>
            )}
          </div>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────── */}
      {!isInventoryIncident && incident.status === 'WaitingReview' && isTPKT && (
        isRejecting ? (
          <div style={{ padding: '12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Lý do từ chối <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Nhập lý do từ chối chi tiết..."
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsRejecting(false)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={rejectMutation.isPending}>
                Hủy
              </button>
              <button onClick={() => rejectMutation.mutate()} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'hsl(var(--danger))' }} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
            <button onClick={() => setIsRejecting(true)} className="btn btn-outline" style={{ minWidth: '140px', fontSize: '0.85rem', padding: '10px', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger))' }}>
              ❌ Từ chối
            </button>
            <button onClick={() => setIsResolving(true)} className="btn btn-primary" style={{ minWidth: '220px', fontSize: '0.85rem', padding: '10px' }}>
              🏗 Thẩm định &amp; Phê duyệt (TPKT)
            </button>
          </div>
        )
      )}
      {isInventoryIncident && incident.status === 'Reported' && isProjectLeader && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
          <button 
            onClick={() => plPushToAccountantMutation.mutate()} 
            className="btn btn-primary" 
            style={{ minWidth: '220px', fontSize: '0.85rem', padding: '10px' }}
            disabled={plPushToAccountantMutation.isPending}
          >
            {plPushToAccountantMutation.isPending ? 'Đang xử lý...' : 'Chuyển Kế toán xác minh'}
          </button>
        </div>
      )}


      {isInventoryIncident && incident.status === 'WaitingAccountant' && isAccountant && (
        isRejecting ? (
          <div style={{ padding: '12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Lý do từ chối <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Nhập lý do từ chối chi tiết..."
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsRejecting(false)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={rejectMutation.isPending}>
                Hủy
              </button>
              <button onClick={() => rejectMutation.mutate()} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'hsl(var(--danger))' }} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
            <button onClick={() => setIsRejecting(true)} className="btn btn-outline" style={{ minWidth: '140px', fontSize: '0.85rem', padding: '10px', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger))' }}>
              ❌ Từ chối
            </button>
            <button onClick={onResolveClick} className="btn btn-primary" style={{ minWidth: '220px', fontSize: '0.85rem', padding: '10px', background: 'hsl(210, 70%, 45%)' }}>
              📦 Xác minh &amp; Tạo Phiếu (Kế toán)
            </button>
          </div>
        )
      )}

      {/* Giám đốc phê duyệt phiếu giảm tồn cho sự cố vật tư */}
      {isInventoryIncident && incident.status === 'WaitingDirector' && isDirector && (
        isRejecting ? (
          <div style={{ padding: '12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Lý do từ chối <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Nhập lý do từ chối chi tiết..."
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsRejecting(false)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={rejectMutation.isPending}>
                Hủy
              </button>
              <button onClick={() => rejectMutation.mutate()} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'hsl(var(--danger))' }} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                {rejectMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
            <button onClick={() => setIsRejecting(true)} className="btn btn-outline" style={{ minWidth: '140px', fontSize: '0.85rem', padding: '10px', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger))' }}>
              ❌ Từ chối
            </button>
            <button
              onClick={() => directorApproveInventoryMutation.mutate()}
              className="btn btn-primary"
              style={{ minWidth: '240px', fontSize: '0.85rem', padding: '10px', background: 'hsl(142, 71%, 40%)' }}
              disabled={directorApproveInventoryMutation.isPending}
            >
              {directorApproveInventoryMutation.isPending ? 'Đang xử lý...' : '🏗 Phê duyệt Giảm tồn (Giám đốc)'}
            </button>
          </div>
        )
      )}

      {/* TPKT duyệt dừng thi công cho sự cố khẩn cấp */}
      {incident.isEmergency && incident.status === 'WaitingStopApproval' && isTPKT && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
          <button onClick={() => setIsRejecting(true)} className="btn btn-outline" style={{ minWidth: '140px', fontSize: '0.85rem', padding: '10px', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger))' }} disabled={approveStopMutation.isPending}>
            ❌ Từ chối
          </button>
          <button onClick={() => approveStopMutation.mutate()} className="btn btn-primary" style={{ minWidth: '220px', fontSize: '0.85rem', padding: '10px', background: 'hsl(0, 72%, 45%)' }} disabled={approveStopMutation.isPending}>
            {approveStopMutation.isPending ? 'Đang xử lý...' : '🛑 Phê duyệt Dừng thi công'}
          </button>
        </div>
      )}

      {/* TPKT lập báo cáo khắc phục */}
      {incident.isEmergency && incident.status === 'WaitingRecoveryPlan' && isTPKT && (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
          <button onClick={() => setIsPlanModalOpen(true)} className="btn btn-primary" style={{ minWidth: '240px', fontSize: '0.85rem', padding: '10px' }}>
            📋 Lập Báo cáo &amp; Kế hoạch Khắc phục
          </button>
        </div>
      )}

      {/* Giám đốc phê duyệt hồ sơ khắc phục */}
      {incident.isEmergency && incident.status === 'WaitingDirectorApproval' && isDirector && (
        isResubmittingByDirector ? (
          <div style={{ padding: '12px', background: 'hsl(var(--bg-muted))', borderRadius: '8px', border: '1px solid hsl(var(--border))', width: '100%' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Yêu cầu chỉnh sửa cụ thể <span style={{ color: 'hsl(var(--danger))' }}>*</span></label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="input"
              rows={3}
              placeholder="Nhập yêu cầu làm lại..."
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsResubmittingByDirector(false)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={directorResubmitMutation.isPending}>
                Hủy
              </button>
              <button onClick={() => directorResubmitMutation.mutate()} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'hsl(var(--danger))' }} disabled={!rejectReason.trim() || directorResubmitMutation.isPending}>
                {directorResubmitMutation.isPending ? 'Đang xử lý...' : 'Xác nhận Yêu cầu làm lại'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid hsl(var(--border))' }}>
            <button onClick={() => setIsResubmittingByDirector(true)} className="btn btn-outline" style={{ minWidth: '180px', fontSize: '0.85rem', padding: '10px', color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning))' }}>
              ⚠️ Yêu cầu làm lại (Resubmit)
            </button>
            <button
              onClick={() => directorApproveDirectlyMutation.mutate()}
              className="btn btn-primary"
              style={{ minWidth: '220px', fontSize: '0.85rem', padding: '10px' }}
              disabled={directorApproveDirectlyMutation.isPending}
            >
              {directorApproveDirectlyMutation.isPending ? 'Đang xử lý...' : '🏗 Duyệt & Áp dụng Phương án'}
            </button>
          </div>
        )
      )}
    </div>
  );

  const handleResolveSuccess = (msg: string) => {
    setIsResolving(false);
    if (onSuccessAction) onSuccessAction(msg);
  };

  const handleResolveError = (msg: string) => {
    toast.error(msg);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      width={(isResolving || isPlanModalOpen) ? 'full' : 'lg'}
      maxWidth={(isResolving || isPlanModalOpen) ? '1180px' : undefined}
      title={
        isPlanModalOpen ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}` }}>
              <TypeIcon size={16} color={meta.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: meta.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                LẬP KẾ HOẠCH KHẮC PHỤC SỰ CỐ
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                {incident.projectName || 'Dự án BPG'} · Sự cố #{incident.id}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="btn btn-outline"
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                title="Quay lại chỉ xem chi tiết 1 cột"
              >
                <ArrowLeft size={14} style={{ marginRight: '4px' }} /> Thu gọn 1 Cột
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', background: meta.bg, border: `1px solid ${meta.border}` }}>
              <TypeIcon size={16} color={meta.color} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: meta.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{meta.label}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Chi tiết Sự cố #{incident.id}</div>
            </div>
            <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700, background: statusColor.bg, color: statusColor.color }}>
              {statusColor.label}
            </div>
          </div>
        )
      }
    >
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        {/* DETAIL PANEL */}
        <div style={{ flex: 1, maxHeight: '74vh', overflowY: 'auto', paddingRight: '12px' }} className="custom-scrollbar">
          {isPlanModalOpen ? (
            <>
              <div style={{ padding: '8px 12px', marginBottom: '16px', background: 'hsl(var(--primary-glow))', borderRadius: '8px', border: '1px solid hsl(var(--primary)/0.2)', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📌 THÔNG TIN SỰ CỐ &amp; THIỆT HẠI (CỘT THAM KHẢO)</span>
              </div>
              {incidentDetailsJSX}
            </>
          ) : (
            incidentDetailsJSX
          )}
        </div>

        {/* RIGHT PANEL FOR PLAN OR RESOLVE FORM */}
        {isPlanModalOpen && (
          <div style={{ flex: 1, maxHeight: '74vh', overflowY: 'auto', paddingLeft: '16px', borderLeft: '1px solid hsl(var(--border))' }} className="custom-scrollbar">
            <CreateRecoveryPlanForm
              incident={incident}
              onSuccess={() => {
                if (onSuccessAction) onSuccessAction('Đã nộp báo cáo khắc phục');
                setIsPlanModalOpen(false);
                onClose();
              }}
              onCancel={() => setIsPlanModalOpen(false)}
            />
          </div>
        )}

        {isResolving && task && members && (
          <div style={{ flex: 1, borderLeft: '1px solid hsl(var(--border))', paddingLeft: '20px', paddingRight: '12px', display: 'flex', flexDirection: 'column', maxHeight: '74vh', overflowY: 'auto' }} className="custom-scrollbar">
            <ResolveIncidentForm
              incident={incident}
              task={task}
              phase={phase}
              members={members}
              user={user}
              onSuccess={handleResolveSuccess}
              onError={handleResolveError}
              onClose={() => setIsResolving(false)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
