using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BPG.Domain.Constants;

namespace BPG.Api.Controllers;

[Authorize]
public class PhaseAcceptancesController : BaseApiController
{
    /// <summary>
    /// [TPKT] Láº¥y danh sÃ¡ch cÃ¡c biÃªn báº£n nghiá»‡m thu (phÃ¢n trang, lá»c theo Phase/Project)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = RolePolicies.Reports)]
    public async Task<IActionResult> GetPhaseAcceptances([FromQuery] BPG.Application.Features.PhaseAcceptances.Queries.GetPhaseAcceptances.GetPhaseAcceptancesQuery request, CancellationToken ct)
    {
        request.ProjectId = null;
        var result = await Mediator.Send(request, ct);
        return ApiPagedOk(result);
    }

    [HttpGet("/api/projects/{projectId:long}/phase-acceptances")]
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
    /// [TPKT] Nghiá»‡m thu Phase (Kiá»ƒm tra 100% Task, táº¡o PDF, khÃ³a Phase)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> AcceptPhase([FromBody] BPG.Application.Features.PhaseAcceptances.Commands.AcceptPhase.AcceptPhaseCommand command, CancellationToken ct)
    {
        var acceptanceId = await Mediator.Send(command, ct);
        return ApiOk(new { AcceptanceId = acceptanceId });
    }

    /// <summary>
    /// [TPKT] Há»§y nghiá»‡m thu (Trong vÃ²ng 7 ngÃ y, báº¯t buá»™c lÃ½ do)
    /// </summary>
    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelAcceptance(long id, [FromBody] BPG.Application.DTOs.PhaseAcceptances.CancelAcceptanceRequest request, CancellationToken ct)
    {
        var command = new BPG.Application.Features.PhaseAcceptances.Commands.CancelAcceptance.CancelAcceptanceCommand(id, request.CancellationReason);
        await Mediator.Send(command, ct);
        return ApiOk("ÄÃ£ há»§y nghiá»‡m thu thÃ nh cÃ´ng.");
    }

}

