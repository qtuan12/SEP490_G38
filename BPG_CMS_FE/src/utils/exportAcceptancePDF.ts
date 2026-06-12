import type {Project, WBSPhase} from '../types/common';
import type { AcceptanceData } from '../types/common';

export const exportAcceptancePDF = (project: Project, phase: WBSPhase, documentData: AcceptanceData) => {
  const { representativeA, roleA, representativeB, roleB, startTime, endTime, drawings, standards, results, quality, opinions, conclusion } = documentData;

  const formatTimeVi = (dateTimeStr: string) => {
    if (!dateTimeStr) return '.............................';
    try {
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return dateTimeStr;
      return `${d.getHours()} giờ ${d.getMinutes()} phút ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
    } catch {
      return dateTimeStr;
    }
  };

  const docTitle = `BIEN_BAN_NGHIEM_THU_${phase.name.toUpperCase().replace(/\s+/g, '_')}.txt`;
  const docContent = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
Độc lập – Tự do – Hạnh phúc
-----------------------
BIÊN BẢN NGHIỆM THU CÔNG VIỆC XÂY DỰNG
SỐ: BB-NT-${phase.id.toUpperCase()}

Công trình: ${project.name}
Địa điểm: ${project.address}
Hạng mục: ${phase.name}

1. Đối tượng nghiệm thu: ${phase.name} (Tất cả công việc hoàn thành 100%)

2. Thành phần trực tiếp nghiệm thu:
● Đại diện Ban quản lý Dự án (hoặc nhà thầu Tư vấn giám sát)
- Ông: ${representativeA || '.............................................'} Chức vụ: ${roleA || '........................................................'}
● Đại diện Nhà thầu thi công:
- Ông: ${representativeB || '..........................................'} Chức vụ: ${roleB || '............................................................'}

3. Thời gian nghiệm thu:
Bắt đầu: ${formatTimeVi(startTime)}
Kết thúc: ${formatTimeVi(endTime)}
Tại công trình: ${project.address}

4. Đánh giá công việc xây dựng đã thực hiện:
a. Về tài liệu làm căn cứ nghiệm thu:
- Phiếu yêu cầu nghiệm thu của nhà thầu thi công xây dựng
- Hồ sơ thiết kế bản vẽ thi công và những thay đổi thiết kế được phê duyệt: Bản vẽ số: ${drawings}
- Tiêu chuẩn, qui phạm xây dựng được áp dụng: ${standards}
- Các kết quả kiểm tra, thí nghiệm chất lượng vật liệu, thiết bị được đưa vào sử dụng: ${results}
- Nhật ký thi công, giám sát và các văn bản khác có liên quan.

b. Về chất lượng công việc xây dựng:
${quality}

c. Các ý kiến khác nếu có:
${opinions || 'Không có ý kiến khác.'}

5. Kết luận:
${conclusion}

CÁN BỘ GIÁM SÁT THI CÔNG                 KỸ THUẬT THI CÔNG TRỰC TIẾP
(Ký, ghi rõ họ tên)                      (Ký, ghi rõ họ tên)
(Đã ký số điện tử)                       (Đã ký số điện tử)

Ông: ${representativeA}                   Ông: ${representativeB}
`;

  // Download file
  const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = docTitle;
  link.click();
  URL.revokeObjectURL(link.href);
};
