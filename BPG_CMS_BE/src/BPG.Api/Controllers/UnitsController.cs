using BPG.Api.Controllers;
using BPG.Application.Features.Units.Commands;
using BPG.Application.Features.Units.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
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
        return ApiOk(result, "Tạo đơn vị tính thành công.");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] BPG.Application.Features.Units.DTOs.UpdateUnitRequest request, CancellationToken ct)
    {
        var command = new UpdateUnitCommand(id, request.UnitCode, request.UnitName);
        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Cập nhật đơn vị tính thành công.");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteUnitCommand(id), ct);
        return ApiOk("Xóa đơn vị tính thành công.");
    }
}
