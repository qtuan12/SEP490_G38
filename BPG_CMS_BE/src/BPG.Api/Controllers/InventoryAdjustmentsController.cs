using BPG.Application.Features.InventoryAdjustments.Commands;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.BusinessUsers)]
        public async Task<IActionResult> CreateIncrease(long projectId, [FromBody] CreateIncreaseAdjustmentCommand command)
        {
            command.ProjectId = projectId;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }

        [HttpPost("decrease")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Accountant)]
        public async Task<IActionResult> CreateDecrease(long projectId, [FromBody] CreateDecreaseAdjustmentCommand command)
        {
            command.ProjectId = projectId;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }

        [HttpPut("{id:long}/approve")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
        public async Task<IActionResult> ApproveDecrease(long projectId, long id, [FromBody] ApproveDecreaseAdjustmentCommand command)
        {
            command.ProjectId = projectId;
            command.AdjustmentId = id;
            var result = await Mediator.Send(command);
            return ApiOk(result);
        }
    }
}
