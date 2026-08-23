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
        weightValidation.List("1 - Bình thường,2 - Cao,3 - Quan trọng,4 - Rất quan trọng");

        // Dropdown list for "Thuê ngoài" column
        var outsourcedValidation = ws.Range("G2:G1000").CreateDataValidation();
        outsourcedValidation.AllowedValues = XLAllowedValues.List;
        outsourcedValidation.List("x");

        // Format Date columns
        ws.Range("D2:E1000").Style.DateFormat.Format = "dd/MM/yyyy";
        
        // Format WBS code column as text
        ws.Range("A2:A1000").Style.NumberFormat.Format = "@";
        // Format Predecessors as text
        ws.Range("K2:K1000").Style.NumberFormat.Format = "@";

        // Example rows
        object[][] examples =
        [
            ["1", "Phần thô", "Thi công phần thô", "01/06/2027", "30/06/2027", "", "", "", "", "", ""],
            ["1.1", "Đổ móng", "Đổ bê tông móng", "01/06/2027", "10/06/2027", "3 - Quan trọng", "x", "Đội xây dựng A", "0987654321", "manager@bpg.com, staff1@bpg.com", ""],
            ["1.1.1", "Ép cọc", "Ép cọc bê tông", "01/06/2027", "05/06/2027", "2 - Cao", "", "", "", "staff1@bpg.com", ""],
            ["1.1.2", "Đào đất", "Đào đất hố móng", "05/06/2027", "08/06/2027", "1 - Bình thường", "", "", "", "staff2@bpg.com", "1.1.1"],
            ["1.2", "Xây tường", "Xây tường bao", "10/06/2027", "25/06/2027", "2 - Cao", "", "", "", "staff3@bpg.com", "1.1"],
            ["2", "Phần hoàn thiện", "Sơn, lát gạch...", "01/07/2027", "31/07/2027", "", "", "", "", "", "1"]
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
        wsGuide.Cell(7, 1).Value = "3. Mức độ ưu tiên: Chọn từ danh sách thả xuống. (Chỉ áp dụng cho công việc).";
        wsGuide.Cell(8, 1).Value = "4. Thuê ngoài: Điền chữ 'x' nếu công việc này giao cho đội thầu phụ bên ngoài, sau đó điền tên đội và SĐT.";
        wsGuide.Cell(9, 1).Value = "5. Nhân viên được giao: Điền email của nhân viên. Dùng dấu phẩy (,) hoặc chấm phẩy (;) để phân cách nhiều email.";
        wsGuide.Cell(10, 1).Value = "6. Công việc cần hoàn thành trước: Điền Chỉ mục của các công việc cần hoàn thành trước. Dùng dấu phẩy hoặc chấm phẩy để phân cách nhiều Chỉ mục.";

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return Task.FromResult(stream.ToArray());
    }
}
