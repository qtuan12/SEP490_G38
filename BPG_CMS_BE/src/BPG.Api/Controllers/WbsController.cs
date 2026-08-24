using BPG.Application.Features.Wbs.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/projects/{projectId}/wbs")]
[ApiController]
[Authorize]
public class WbsController : BaseApiController
{
    [HttpGet]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetWbsTree([FromRoute] long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetWbsTreeQuery(projectId), ct);
        return ApiOk(result);
    }

    [HttpPost("import")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting(BPG.Api.Configuration.RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> ImportWbsTree([FromRoute] long projectId, Microsoft.AspNetCore.Http.IFormFile file, CancellationToken ct)
    {
        var result = await Mediator.Send(new BPG.Application.Features.Wbs.Commands.ImportWbsCommand(projectId, file), ct);
        return ApiOk(result, "Import cấu trúc WBS thành công.");
    }

    [HttpPost("import/preview")]
    [Microsoft.AspNetCore.RateLimiting.EnableRateLimiting(BPG.Api.Configuration.RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> PreviewWbsImport([FromRoute] long projectId, Microsoft.AspNetCore.Http.IFormFile file, CancellationToken ct)
    {
        var result = await Mediator.Send(new BPG.Application.Features.Wbs.Commands.PreviewWbsImportCommand(projectId, file), ct);
        return ApiOk(result, "Lấy dữ liệu xem trước thành công.");
    }

    [HttpGet("template")]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> DownloadTemplate(CancellationToken ct)
    {
        var fileBytes = await Mediator.Send(new BPG.Application.Features.Wbs.Queries.GetWbsImportTemplateQuery(), ct);
        return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "mau_cau_truc_wbs.xlsx");
    }
}
