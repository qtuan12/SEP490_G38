using BPG.Api.Controllers;
using BPG.Application.Features.Units.Commands;
using BPG.Application.Features.Units.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize(Roles = RolePolicies.MasterData)]
[Route("api/[controller]")]
public class UnitsController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] GetUnitsQuery query, CancellationToken ct)
    {
        var result = await Mediator.Send(query, ct);
        return ApiOk(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUnitCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Táº¡o Ä‘Æ¡n vá»‹ tÃ­nh thÃ nh cÃ´ng.");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] BPG.Application.DTOs.Units.UpdateUnitRequest request, CancellationToken ct)
    {
        var command = new UpdateUnitCommand(id, request.UnitCode, request.UnitName, request.IsDiscrete);
        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Cáº­p nháº­t Ä‘Æ¡n vá»‹ tÃ­nh thÃ nh cÃ´ng.");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteUnitCommand(id), ct);
        return ApiOk("XÃ³a Ä‘Æ¡n vá»‹ tÃ­nh thÃ nh cÃ´ng.");
    }
}

