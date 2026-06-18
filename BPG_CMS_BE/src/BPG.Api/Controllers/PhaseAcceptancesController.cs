using BPG.Application.DTOs;
using BPG.Application.IServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class PhaseAcceptancesController : BaseApiController
{
    private readonly IPdfService _pdfService;

    public PhaseAcceptancesController(IPdfService pdfService)
    {
        _pdfService = pdfService;
    }

    /// <summary>
    /// [TPKT] Lấy danh sách các biên bản nghiệm thu (phân trang, lọc theo Phase/Project)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetPhaseAcceptances([FromQuery] BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances.GetPhaseAcceptancesQuery request, CancellationToken ct)
    {
        var result = await Mediator.Send(request, ct);
        return ApiPagedOk(result);
    }

    /// <summary>
    /// [TPKT] Nghiệm thu Phase (Kiểm tra 100% Task, tạo PDF, khóa Phase)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AcceptPhase([FromBody] BPG.Application.Features.PhaseAcceptances.Commands.AcceptPhase.AcceptPhaseCommand command, CancellationToken ct)
    {
        var acceptanceId = await Mediator.Send(command, ct);
        return ApiOk(new { AcceptanceId = acceptanceId });
    }

    /// <summary>
    /// [TPKT] Hủy nghiệm thu (Trong vòng 7 ngày, bắt buộc lý do)
    /// </summary>
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelAcceptance(long id, [FromBody] BPG.Application.Features.PhaseAcceptances.DTOs.CancelAcceptanceRequest request, CancellationToken ct)
    {
        var command = new BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance.CancelAcceptanceCommand(id, request.CancellationReason);
        await Mediator.Send(command, ct);
        return ApiOk("Đã hủy nghiệm thu thành công.");
    }

    /// <summary>
    /// [TEST ENDPOINT] Sinh thử file PDF báo cáo nghiệm thu mẫu.
    /// </summary>
    [HttpGet("test-pdf")]
    [AllowAnonymous]
    public IActionResult TestGeneratePdf()
    {
        var dummyData = new PhaseAcceptancePdfModel
        {
            ProjectName = "Dự án Khu chung cư BPG",
            PhaseName = "Giai đoạn 1: Thi công phần móng",
            AcceptedByFullName = "Nguyễn Văn Test (TPKT)",
            AcceptanceDate = DateTime.Now,
            ReportContent = "Tất cả các hạng mục móng đã hoàn thành xuất sắc. Đảm bảo đúng tiêu chuẩn bản vẽ.",
            Tasks = new List<PhaseAcceptanceTaskDto>
            {
                new PhaseAcceptanceTaskDto { TaskName = "Đào đất móng", AssigneeName = "Lê Văn A", ProgressPercent = 100 },
                new PhaseAcceptanceTaskDto { TaskName = "Đóng cọc bê tông", AssigneeName = "Trần Thị B", ProgressPercent = 100 },
                new PhaseAcceptanceTaskDto { TaskName = "Đổ bê tông lót", AssigneeName = "Phạm Văn C", ProgressPercent = 100 }
            }
        };

        var pdfBytes = _pdfService.GeneratePhaseAcceptancePdf(dummyData);

        return File(pdfBytes, "application/pdf", "BienBanNghiemThu_Test.pdf");
    }
}
