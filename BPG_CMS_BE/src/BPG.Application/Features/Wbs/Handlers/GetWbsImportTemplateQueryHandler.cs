using BPG.Application.Features.Wbs.Queries;
using ClosedXML.Excel;
using MediatR;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Wbs.Handlers;

public class GetWbsImportTemplateQueryHandler : IRequestHandler<GetWbsImportTemplateQuery, byte[]>
{
    public Task<byte[]> Handle(GetWbsImportTemplateQuery request, CancellationToken cancellationToken)
    {
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Cấu trúc WBS");

        // Header row
        var headers = new[] { 
            "Chỉ mục (*)", 
            "Tên giai đoạn / Công việc (*)", 
            "Mô tả", 
            "Ngày bắt đầu (*)", 
            "Ngày kết thúc (*)", 
            "Mức độ ưu tiên", 
            "Thuê ngoài (x/trống)", 
            "Tên đội thuê ngoài", 
            "SĐT liên hệ",
            "Nhân viên được giao",
            "Công việc cần hoàn trước"
        };
        
        for (int i = 0; i < headers.Length; i++)
        {
            ws.Cell(1, i + 1).Value = headers[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
        }

        // Dropdown list for "Mức độ ưu tiên" column
        var weightValidation = ws.Range("F2:F1000").CreateDataValidation();
        weightValidation.AllowedValues = XLAllowedValues.List;
        weightValidation.List("\"1,2,3,4\"");

        // Dropdown list for "Thuê ngoài" column
        var outsourcedValidation = ws.Range("G2:G1000").CreateDataValidation();
        outsourcedValidation.AllowedValues = XLAllowedValues.List;
        outsourcedValidation.List("\"x\"");

        // Format Date columns
        ws.Range("D2:E1000").Style.DateFormat.Format = "dd/MM/yyyy";
        
        // Format WBS code column as text
        ws.Range("A2:A1000").Style.NumberFormat.Format = "@";
        // Format Predecessors as text
        ws.Range("K2:K1000").Style.NumberFormat.Format = "@";

        // Example rows
        object[][] examples =
        [
            ["1", "Phần thô", "Thi công phần thô", "26/08/2026", "05/10/2026", "", "", "", "", "", ""],
            ["1.1", "Thi công móng", "Thi công toàn bộ hạng mục móng", "26/08/2026", "12/09/2026", "3", "x", "Đội xây dựng A", "0987654321", "kysu17@bpg.com", ""],
            ["1.1.1", "Ép cọc bê tông", "Thi công ép cọc bê tông", "26/08/2026", "30/08/2026", "2", "", "", "", "kysu10@bpg.com", ""],
            ["1.1.2", "Đào đất hố móng", "Đào đất và vệ sinh", "31/08/2026", "02/09/2026", "2", "", "", "", "kysu10@bpg.com", "1.1.1"],
            ["1.1.3", "Lắp dựng cốt thép móng", "Gia công và lắp dựng thép", "02/09/2026", "03/09/2026", "3", "", "", "", "kysu13@bpg.com", "1.1.2"],
            ["1.1.4", "Lắp dựng cốp pha và đổ bê tông", "Lắp cốp pha, đổ bê tông", "06/09/2026", "07/09/2026", "3", "", "", "", "kysu17@bpg.com", "1.1.3"],
            ["1.1.5", "Bảo dưỡng bê tông móng", "Bảo dưỡng sau đổ bê tông", "09/09/2026", "10/09/2026", "2", "", "", "", "kysu10@bpg.com", ""],
            ["1.2", "Xây tường tầng 1", "Xây tường bao và tường ngăn", "13/09/2026", "26/09/2026", "2", "", "", "", "kysu13@bpg.com", ""],
            ["1.2.1", "Xây tường bao và vách ngăn kỹ thuật", "Xây gạch đặc vách khu vệ sinh, kỹ thuật", "13/09/2026", "21/09/2026", "2", "", "", "", "kysu13@bpg.com", ""],
            ["1.2.2", "Đổ giằng bê tông, lanh tô cửa", "Gia công đổ bê tông lanh tô cửa sổ, cửa đi", "22/09/2026", "26/09/2026", "2", "", "", "", "kysu10@bpg.com", ""],
            ["1.3", "Trát hoàn thiện thô", "Trát tường, dầm trần toàn bộ diện tích", "27/09/2026", "05/10/2026", "2", "", "", "", "kysu13@bpg.com", ""],
            ["1.3.1", "Trát hoàn thiện thô", "Trát tường, dầm trần toàn bộ diện tích", "27/09/2026", "02/10/2026", "2", "", "", "", "kysu13@bpg.com", ""],
            ["1.3.2", "Chống thấm sàn khu vệ sinh & ban công", "Quét màng chống thấm 2 thành phần, ngâm thử nước", "03/10/2026", "05/10/2026", "3", "", "", "", "kysu17@bpg.com", ""],
            ["2", "Hệ thống cơ điện & mạng (MEP)", "Thi công toàn bộ hệ thống MEP và CNTT", "06/10/2026", "05/11/2026", "", "", "", "", "", ""],
            ["2.1", "Hệ thống cấp thoát nước", "Lắp đặt ống cấp nước PPR và thoát nước PVC", "06/10/2026", "13/10/2026", "3", "x", "Đội MEP Minh Đức", "0971234567", "kysu5@bpg.com", ""],
            ["2.2", "Hệ thống ống luồn dây điện & cáp nguồn", "Đi âm tường và đi trên trần hệ thống ống luồn", "11/10/2026", "13/10/2026", "3", "", "", "", "kysu5@bpg.com", ""],
            ["2.3", "Hệ thống điều hòa không khí (HVAC)", "Lắp đặt ống đồng, ống gió và dàn lạnh âm trần", "16/10/2026", "18/10/2026", "3", "x", "Nhà thầu Daikin Pro", "0982233445", "kysu9@bpg.com", ""],
            ["2.4", "Hệ thống phòng cháy chữa cháy (PCCC)", "Đi ống cứu hỏa, đầu sprinkler và cảm biến khói", "16/10/2026", "25/10/2026", "3", "x", "PCCC Thăng Long", "0918776655", "kysu17@bpg.com", ""],
            ["2.5", "Hệ thống mạng LAN, Camera & Kiểm soát vào ra", "Kéo dây mạng Cat6, lắp đặt tủ Rack & camera", "22/10/2026", "31/10/2026", "2", "x", "IT Solutions Tech", "0905123123", "kysu9@bpg.com", ""],
            ["3", "Hoàn thiện kiến trúc & nội thất", "Thi công trần, tường, sàn và nội thất văn phòng", "29/10/2026", "18/12/2026", "", "", "", "", "", ""],
            ["3.1", "Đóng trần thạch cao & trần nhôm", "Lắp khung xương và bắn tấm thạch cao chịu ẩm", "06/11/2026", "18/12/2026", "2", "x", "Thạch cao Vĩnh Tường", "0932112233", "kysu15@bpg.com", ""],
            ["3.2", "Ốp lát gạch & ốp đá sảnh tiếp tân", "Lát gạch nền vệ sinh, ốp đá trang trí lễ tân", "12/11/2026", "15/11/2026", "2", "", "", "", "kysu13@bpg.com", ""],
            ["3.3", "Sơn bả tường và trần", "Bả matit 2 lớp và sơn hoàn thiện Dulux 2 lớp phủ", "16/11/2026", "20/11/2026", "2", "x", "Đội sơn Hải Âu", "0977665544", "kysu15@bpg.com", ""],
            ["3.4", "Lắp đặt vách kính cường lực & cửa ra vào", "Lắp hệ vách nhôm kính xingfa và cửa kính thủy lực", "16/11/2026", "26/11/2026", "3", "x", "Kính Hải Long", "0911223344", "kysu15@bpg.com", ""],
            ["3.5", "Lắp đặt thiết bị điện, chiếu sáng & vệ sinh", "Gắn đèn LED, công tắc ổ cắm, bồn cầu, lavabo", "25/11/2026", "07/12/2026", "3", "", "", "", "kysu5@bpg.com", ""],
            ["3.6", "Lắp đặt sàn gỗ / thảm trải sàn văn phòng", "Trải thảm tấm phòng làm việc và lát sàn gỗ phòng GĐ", "06/12/2026", "11/12/2026", "2", "x", "Nội thất Sàn Đẹp", "0944556677", "kysu15@bpg.com", ""],
            ["3.7", "Lắp đặt đồ gỗ nội thất & module bàn làm việc", "Lắp cụm bàn làm việc, tủ hồ sơ, ghế, quầy lễ tân", "10/12/2026", "18/12/2026", "2", "x", "Nội thất Hòa Phát Pro", "0968998877", "kysu15@bpg.com", ""],
            ["4", "Kiểm thử, nghiệm thu & bàn giao", "Chạy thử hệ thống, nghiệm thu PCCC và bàn giao", "19/12/2026", "31/12/2026", "", "", "", "", "", ""],
            ["4.1", "Chạy thử liên động hệ thống MEP & PCCC", "Test tải điện áp, áp lực nước và báo cháy tự động", "19/12/2026", "22/12/2026", "3", "", "", "", "kysu5@bpg.com", ""],
            ["4.2", "Vệ sinh công nghiệp tổng thể", "Vệ sinh kính, hút bụi thảm, khử mùi sơn văn phòng", "19/12/2026", "25/12/2026", "1", "x", "Clean & Clean Pro", "0909123789", "kysu10@bpg.com", ""],
            ["4.3", "Nghiệm thu nội bộ & xử lý lỗi (Defect list)", "Kiểm tra chi tiết từng phòng, dặm vá sơn, căn chỉnh cửa", "23/12/2026", "28/12/2026", "2", "", "", "", "kysu17@bpg.com", ""],
            ["4.4", "Nghiệm thu PCCC với cơ quan chức năng", "Tiếp đoàn kiểm tra và nhận biên bản nghiệm thu", "26/12/2026", "29/12/2026", "3", "x", "PCCC Thăng Long", "0918776655", "kysu17@bpg.com", ""],
            ["4.5", "Bàn giao chìa khóa & hồ sơ hoàn công CĐT", "Ký biên bản bàn giao và cung cấp hồ sơ bảo hành", "29/12/2026", "31/12/2026", "3", "", "", "", "leader8@bpg.com", ""]
        ];
        
        for (int r = 0; r < examples.Length; r++)
        {
            for (int c = 0; c < examples[r].Length; c++)
            {
                ws.Cell(r + 2, c + 1).Value = XLCellValue.FromObject(examples[r][c]);
            }
        }

        ws.Columns().AdjustToContents();

        // Guide sheet
        var wsGuide = workbook.Worksheets.Add("Hướng dẫn");
        wsGuide.Cell(1, 1).Value = "HƯỚNG DẪN IMPORT CẤU TRÚC WBS";
        wsGuide.Cell(1, 1).Style.Font.Bold = true;
        wsGuide.Cell(2, 1).Value = "1. Cột Chỉ mục (*): Quy định cấu trúc phân cấp. KHÔNG dùng quá 3 cấp.";
        wsGuide.Cell(3, 1).Value = "   - Cấp 1 (Giai đoạn): 1, 2, 3...";
        wsGuide.Cell(4, 1).Value = "   - Cấp 2 (Công việc): 1.1, 1.2, 2.1...";
        wsGuide.Cell(5, 1).Value = "   - Cấp 3 (Công việc con): 1.1.1, 1.1.2...";
        wsGuide.Cell(6, 1).Value = "2. Ngày tháng: Định dạng dd/MM/yyyy. Ngày công việc phải nằm trong ngày giai đoạn/công việc cha.";
        wsGuide.Cell(7, 1).Value = "3. Mức độ ưu tiên: Chọn mức 1, 2, 3, 4 từ danh sách thả xuống (Chỉ áp dụng cho công việc).";
        wsGuide.Cell(8, 1).Value = "4. Thuê ngoài: Điền chữ 'x' nếu công việc này giao cho đội thầu phụ bên ngoài, sau đó điền tên đội và SĐT.";
        wsGuide.Cell(9, 1).Value = "5. Nhân viên được giao: Điền email của nhân viên. Dùng dấu phẩy (,) hoặc chấm phẩy (;) để phân cách nhiều email.";
        wsGuide.Cell(10, 1).Value = "6. Công việc cần hoàn thành trước: Điền Chỉ mục của các công việc cần hoàn thành trước. Dùng dấu phẩy hoặc chấm phẩy để phân cách nhiều Chỉ mục.";

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return Task.FromResult(stream.ToArray());
    }
}
