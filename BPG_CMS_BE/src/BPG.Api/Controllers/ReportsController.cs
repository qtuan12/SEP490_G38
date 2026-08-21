using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
using BPG.Api.Configuration;
using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;
using BPG.Application.Features.Reports.Queries.GetIncidentReport;
using BPG.Application.Features.Reports.Queries.GetProcurementReport;
using BPG.Application.Features.Reports.Queries.GetConsolidatedExecutiveReport;
using BPG.Application.Features.Reports.Queries.GetMaterialReturnsAndSurplusReport;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.RateLimiting;

namespace BPG.Api.Controllers;

[Authorize(Roles = RolePolicies.Reports)]
[EnableRateLimiting(RateLimitPolicies.Report)]
public class ReportsController : BaseApiController
{
    [HttpGet("project/{projectId}/executive-dashboard")]
    public async Task<IActionResult> GetExecutiveDashboard(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetExecutiveDashboardQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/consolidated-executive")]
    public async Task<IActionResult> GetConsolidatedExecutiveReport(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetConsolidatedExecutiveReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/boq-vs-actual")]
    public async Task<IActionResult> GetBoqVsActual(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetBoqVsActualReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/construction-progress")]
    public async Task<IActionResult> GetConstructionProgress(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetConstructionProgressReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/incidents")]
    public async Task<IActionResult> GetIncidentReport(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetIncidentReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/procurement")]
    public async Task<IActionResult> GetProcurementReport(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetProcurementReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/returns-and-surplus")]
    public async Task<IActionResult> GetMaterialReturnsAndSurplusReport(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetMaterialReturnsAndSurplusReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }
}

