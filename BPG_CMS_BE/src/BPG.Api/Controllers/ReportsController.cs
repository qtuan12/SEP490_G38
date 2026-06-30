using BPG.Application.Features.Reports.Queries.GetExecutiveDashboard;
using BPG.Application.Features.Reports.Queries.GetGanttChartData;
using BPG.Application.Features.Reports.Queries.GetBoqVsActualReport;
using BPG.Application.Features.Reports.Queries.GetCostReferenceReport;
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
}
