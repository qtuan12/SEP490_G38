using BPG.Application.Features.Phases.Commands.CreatePhase;
using BPG.Application.Features.Phases.Commands.DeletePhase;
using BPG.Application.Features.Phases.Commands.UpdatePhase;
using BPG.Application.Features.Phases.Commands.UpdatePhaseBOQ;
using BPG.Application.DTOs.Phases;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/projects/{projectId}/phases")]
[ApiController]
[Authorize] // Có thể thêm rule Role sau tùy vào policy của dự án
public class PhasesController : BaseApiController
{
    [HttpPost]
    public async Task<IActionResult> CreatePhase([FromRoute] long projectId, [FromBody] CreatePhaseCommand command, CancellationToken ct)
    {
        if (projectId != command.ProjectId)
            return BadRequest(new { Message = "ProjectId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPut("{phaseId}")]
    public async Task<IActionResult> UpdatePhase([FromRoute] long projectId, [FromRoute] long phaseId, [FromBody] UpdatePhaseCommand command, CancellationToken ct)
    {
        if (phaseId != command.PhaseId)
            return BadRequest(new { Message = "PhaseId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPut("{phaseId}/boq")]
    [Authorize(Policy = PolicyNames.RequireTechnicalManager)]
    public async Task<IActionResult> UpdatePhaseBOQ([FromRoute] long projectId, [FromRoute] long phaseId, [FromBody] UpdatePhaseBOQRequest request, CancellationToken ct)
    {
        var result = await Mediator.Send(new UpdatePhaseBOQCommand(projectId, phaseId, request.Items), ct);
        return ApiOk(result);
    }

    [HttpDelete("{phaseId}")]
    public async Task<IActionResult> DeletePhase([FromRoute] long projectId, [FromRoute] long phaseId, CancellationToken ct)
    {
        var result = await Mediator.Send(new DeletePhaseCommand(phaseId), ct);
        return ApiOk(result);
    }
}
