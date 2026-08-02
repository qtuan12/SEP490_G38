using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;
using BPG.Application.Features.Reports.Queries.GetIncidentReport;
using BPG.Application.Features.Reports.Queries.GetInventoryLedgerReport;
using BPG.Application.Features.Reports.Queries.GetInventoryMovementReport;
using BPG.Application.Features.Reports.Queries.GetProcurementReport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class ReportsController : BaseApiController
{
    [HttpGet("project/{projectId}/executive-dashboard")]
    public async Task<IActionResult> GetExecutiveDashboard(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetExecutiveDashboardQuery(projectId, fromDate, toDate), ct);
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

    [HttpGet("project/{projectId}/inventory-movement")]
    public async Task<IActionResult> GetInventoryMovement(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetInventoryMovementReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/inventory-ledger")]
    public async Task<IActionResult> GetInventoryLedger(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetInventoryLedgerReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/procurement")]
    public async Task<IActionResult> GetProcurementReport(long projectId, [FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetProcurementReportQuery(projectId, fromDate, toDate), ct);
        return ApiOk(result.Data);
    }
}
