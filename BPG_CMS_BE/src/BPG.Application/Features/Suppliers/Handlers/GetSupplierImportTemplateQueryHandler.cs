using BPG.Application.Features.Suppliers.Queries;
using ClosedXML.Excel;
using MediatR;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Application.Features.Suppliers.Handlers
{
    public class GetSupplierImportTemplateQueryHandler : IRequestHandler<GetSupplierImportTemplateQuery, byte[]>
    {
        public async Task<byte[]> Handle(GetSupplierImportTemplateQuery request, CancellationToken cancellationToken)
        {
            using var workbook = new XLWorkbook();
            var ws = workbook.Worksheets.Add("Nhà cung cấp");

            // Header row
            var headers = new[] { "STT", "Tên nhà cung cấp (*)", "Thông tin liên hệ", "Địa chỉ", "Khu vực phục vụ", "Đánh giá (0-5)", "Ghi chú đánh giá" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
                ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            }

            // Example rows
            object[][] examples =
            [
                [1, "Công ty TNHH ABC", "0901234567", "Số 1 Lê Lợi - Q.1 - TP.HCM", "TP. Hồ Chí Minh", 4.5, "Nhà cung cấp uy tín"],
                [2, "Nhà cung cấp XYZ", "0912345678", "123 Nguyễn Huệ - Hà Nội", "Hà Nội", "", ""],
            ];
            
            for (int r = 0; r < examples.Length; r++)
            {
                for (int c = 0; c < examples[r].Length; c++)
                {
                    ws.Cell(r + 2, c + 1).Value = XLCellValue.FromObject(examples[r][c]);
                }
            }

            ws.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            return stream.ToArray();
        }
    }
}
