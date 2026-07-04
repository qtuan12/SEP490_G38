using BPG.Application.Features.Wbs.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/projects/{projectId}/wbs")]
[ApiController]
[Authorize]
public class WbsController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetWbsTree([FromRoute] long projectId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetWbsTreeQuery(projectId), ct);
        return ApiOk(result);
    }
}
