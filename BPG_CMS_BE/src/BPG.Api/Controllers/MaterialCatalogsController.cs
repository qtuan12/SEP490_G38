using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.Features.MaterialCatalogs.DTOs;
using BPG.Application.Features.MaterialCatalogs.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
public class MaterialCatalogsController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] GetMaterialCatalogsQuery query, CancellationToken ct)
    {
        var result = await Mediator.Send(query, ct);
        return ApiPagedOk(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaterialCatalogRequest request, CancellationToken ct)
    {
        var command = new CreateMaterialCatalogCommand(
            request.CategoryId,
            request.BaseUnitId,
            request.Code,
            request.Name,
            request.Specification
        );

        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Tạo vật tư thành công.");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateMaterialCatalogRequest request, CancellationToken ct)
    {
        var command = new UpdateMaterialCatalogCommand(
            id,
            request.CategoryId,
            request.BaseUnitId,
            request.Code,
            request.Name,
            request.Specification
        );

        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Cập nhật vật tư thành công.");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteMaterialCatalogCommand(id), ct);
        return ApiOk("Xóa vật tư thành công.");
    }
}
