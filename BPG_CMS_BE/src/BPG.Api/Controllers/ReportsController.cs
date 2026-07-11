using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
using BPG.Application.Features.Reports.Queries.GetGanttChartData;
using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetCostReferenceReport;
using BPG.Application.Features.Reports.Queries.GetConstructionProgressReport;
using BPG.Application.Features.Reports.Queries.GetIncidentReport;
using BPG.Application.Features.Reports.Queries.GetInventoryLedgerReport;
using BPG.Application.Features.Reports.Queries.GetProcurementReport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class ReportsController : BaseApiController
{
    [HttpGet("project/{projectId}/executive-dashboard")]
    public async Task<IActionResult> GetExecutiveDashboard(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetExecutiveDashboardQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/gantt-chart")]
    public async Task<IActionResult> GetGanttChart(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetGanttChartDataQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/boq-vs-actual")]
    public async Task<IActionResult> GetBoqVsActual(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetBoqVsActualReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/cost-reference")]
    public async Task<IActionResult> GetCostReference(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetCostReferenceReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/construction-progress")]
    public async Task<IActionResult> GetConstructionProgress(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetConstructionProgressReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/incidents")]
    public async Task<IActionResult> GetIncidentReport(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetIncidentReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/inventory-ledger")]
    public async Task<IActionResult> GetInventoryLedger(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetInventoryLedgerReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }

    [HttpGet("project/{projectId}/procurement")]
    public async Task<IActionResult> GetProcurementReport(long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetProcurementReportQuery(projectId), ct);
        return ApiOk(result.Data);
    }
}
