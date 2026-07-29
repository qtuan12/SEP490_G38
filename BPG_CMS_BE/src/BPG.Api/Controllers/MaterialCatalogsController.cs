using BPG.Application.Features.MaterialCatalogs.Commands;
using BPG.Application.DTOs.MaterialCatalogs;
using BPG.Application.Features.MaterialCatalogs.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BPG.Application.Features.MaterialConversions.Queries;
using BPG.Application.Features.MaterialConversions.Commands;
using BPG.Application.DTOs.MaterialConversions;
using BPG.Domain.Constants;
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
    [Authorize(Roles = RolePolicies.MasterData)]
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
        return ApiOk(result, "Táº¡o váº­t tÆ° thÃ nh cÃ´ng.");
    }

    [HttpPut("{id}")]
    [Authorize(Roles = RolePolicies.MasterData)]
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
        return ApiOk(result, "Cáº­p nháº­t váº­t tÆ° thÃ nh cÃ´ng.");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = RolePolicies.MasterData)]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteMaterialCatalogCommand(id), ct);
        return ApiOk("XÃ³a váº­t tÆ° thÃ nh cÃ´ng.");
    }

    [HttpGet("{id}/conversions")]
    public async Task<IActionResult> GetConversions(long id, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetConversionsByMaterialIdQuery(id), ct);
        return ApiOk(result);
    }

    [HttpPut("{id}/conversions")]
    [Authorize(Roles = RolePolicies.MasterData)]
    public async Task<IActionResult> SyncConversions(long id, [FromBody] List<MaterialConversionRequest> request, CancellationToken ct)
    {
        await Mediator.Send(new SyncMaterialConversionsCommand(id, request), ct);
        var result = await Mediator.Send(new GetConversionsByMaterialIdQuery(id), ct);
        return ApiOk(result, "Cáº­p nháº­t tá»· lá»‡ quy Ä‘á»•i váº­t tÆ° thÃ nh cÃ´ng.");
    }
}

