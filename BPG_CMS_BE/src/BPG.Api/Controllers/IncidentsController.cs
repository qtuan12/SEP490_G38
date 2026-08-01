using BPG.Application.Features.Incidents.Commands.CreateAndAssessIncident;
using BPG.Application.Features.Incidents.Commands.ConfirmIncident;
using BPG.Application.Features.Incidents.Queries.GetIncidents;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class IncidentsController : BaseApiController
{
    [HttpGet("all")]
    [Authorize(Roles = RolePolicies.DirectorTechnicalManagerAccountant)]
    public async Task<IActionResult> GetAllIncidents(CancellationToken ct)
    {
        var result = await Mediator.Send(new BPG.Application.Features.Incidents.Queries.GetAllIncidents.GetAllIncidentsQuery(), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}")]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetIncidents(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetIncidentsQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpPost]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> CreateAndAssessIncident([FromBody] CreateAndAssessIncidentCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return ApiOk(result.Data, result.Message ?? "Success");
    }

    [HttpPut("{id}/confirm")]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> ConfirmIncident(long id, [FromBody] ConfirmIncidentCommand command, CancellationToken ct)
    {
        if (id != command.IncidentId)
        {
            return ApiBadRequest("Id mismatch");
        }

        var result = await Mediator.Send(command, ct);
        return ApiOk(result.Data, result.Message ?? "Success");
    }

    [HttpPut("{id}/reject")]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> RejectIncident(long id, [FromBody] BPG.Application.Features.Incidents.Commands.RejectIncident.RejectIncidentCommand command, CancellationToken ct)
    {
        if (id != command.IncidentId)
        {
            return ApiBadRequest("Id mismatch");
        }

        var result = await Mediator.Send(command, ct);
        return ApiOk(result.Data, result.Message ?? "Success");
    }
}

