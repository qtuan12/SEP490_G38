using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
using Microsoft.AspNetCore.Mvc;
using BPG.Domain.Constants;

namespace BPG.Api.Controllers;

[Authorize]
public class PhaseAcceptancesController : BaseApiController
{
    /// <summary>
    /// [TPKT] Lấy danh sách các biên bản nghiệm thu (phân trang, lọc theo Phase/Project)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = RolePolicies.DirectorTechnicalManagerAccountant)]
    public async Task<IActionResult> GetPhaseAcceptances([FromQuery] BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances.GetPhaseAcceptancesQuery request, CancellationToken ct)
    {
        request.ProjectId = null;
        var result = await Mediator.Send(request, ct);
        return ApiPagedOk(result);
    }

    [HttpGet("/api/projects/{projectId:long}/phase-acceptances")]
    [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetProjectPhaseAcceptances(
        [FromRoute] long projectId,
        [FromQuery] BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances.GetPhaseAcceptancesQuery request,
        CancellationToken ct)
    {
        request.ProjectId = projectId;
        var result = await Mediator.Send(request, ct);
        return ApiPagedOk(result);
    }

    /// <summary>
    /// [TPKT] Nghiệm thu Phase (Kiểm tra 100% Task, tạo PDF, khóa Phase)
    /// </summary>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> AcceptPhase([FromBody] BPG.Application.Features.PhaseAcceptances.Commands.AcceptPhase.AcceptPhaseCommand command, CancellationToken ct)
    {
        var acceptanceId = await Mediator.Send(command, ct);
        return ApiOk(new { AcceptanceId = acceptanceId });
    }

    /// <summary>
    /// [TPKT] Hủy nghiệm thu (Trong vòng 7 ngày, bắt buộc lý do)
    /// </summary>
    [HttpPut("{id}/cancel")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> CancelAcceptance(long id, [FromBody] BPG.Application.DTOs.PhaseAcceptances.CancelAcceptanceRequest request, CancellationToken ct)
    {
        var command = new BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance.CancelAcceptanceCommand(id, request.CancellationReason);
        await Mediator.Send(command, ct);
        return ApiOk("Đã hủy nghiệm thu thành công.");
    }

}
