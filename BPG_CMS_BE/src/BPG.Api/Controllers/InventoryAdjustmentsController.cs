using BPG.Application.Features.InventoryAdjustments.Commands;
using BPG.Application.Features.InventoryAdjustments.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    [Route("api/projects/{projectId:long}/inventory-adjustments")]
    public class InventoryAdjustmentsController : BaseApiController
    {
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetList(long projectId, [FromQuery] GetInventoryAdjustmentsQuery query)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách phiếu điều chỉnh thành công");
        }

        [HttpPost("increase")]
        [Authorize(Roles = RolePolicies.BusinessUsers)]
        public async Task<IActionResult> CreateIncrease(long projectId, [FromBody] CreateIncreaseAdjustmentCommand command)
        {
            command.ProjectId = projectId;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }

        [HttpPost("decrease")]
        [Authorize(Roles = RolePolicies.Accountant)]
        public async Task<IActionResult> CreateDecrease(long projectId, [FromBody] CreateDecreaseAdjustmentCommand command)
        {
            command.ProjectId = projectId;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }

        [HttpPut("{id:long}/approve")]
        [Authorize(Roles = RolePolicies.DirectorTechnicalManagerAccountant)]
        public async Task<IActionResult> ApproveDecrease(long projectId, long id, [FromBody] ApproveDecreaseAdjustmentCommand command)
        {
            command.AdjustmentId = id;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }
    }
}
