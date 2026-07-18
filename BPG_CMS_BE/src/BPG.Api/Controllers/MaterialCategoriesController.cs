using BPG.Application.Features.MaterialCategories.Commands;
using BPG.Application.Features.MaterialCategories.Queries;
using BPG.Application.DTOs.MaterialCategories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
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
        return ApiOk(result, "Tạo loại vật tư thành công.");
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
        return ApiOk(result, "Cập nhật loại vật tư thành công.");
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteMaterialCategoryCommand(id), ct);
        return ApiOk("Xóa loại vật tư thành công.");
    }
}
