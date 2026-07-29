using BPG.Application.Features.MaterialCategories.Commands;
using BPG.Application.Features.MaterialCategories.Queries;
using BPG.Application.DTOs.MaterialCategories;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize(Roles = RolePolicies.MasterData)]
public class MaterialCategoriesController : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] GetMaterialCategoriesQuery query, CancellationToken ct)
    {
        var result = await Mediator.Send(query, ct);
        return ApiPagedOk(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaterialCategoryCommand command, CancellationToken ct)
    {
        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Táº¡o loáº¡i váº­t tÆ° thÃ nh cÃ´ng.");
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateMaterialCategoryRequest request, CancellationToken ct)
    {
        var command = new UpdateMaterialCategoryCommand
        {
            CategoryId = id,
            CategoryName = request.CategoryName,
            Description = request.Description
        };

        var result = await Mediator.Send(command, ct);
        return ApiOk(result, "Cáº­p nháº­t loáº¡i váº­t tÆ° thÃ nh cÃ´ng.");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteMaterialCategoryCommand(id), ct);
        return ApiOk("XÃ³a loáº¡i váº­t tÆ° thÃ nh cÃ´ng.");
    }
}

