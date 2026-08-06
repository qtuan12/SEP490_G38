using BPG.Application.Features.Inventory.Queries;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    [Route("api/projects/{projectId:long}/[controller]")]
    public class InventoryController : BaseApiController
    {
        /// <summary>
        /// Lấy tồn kho hiện tại của một dự án.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetCurrentInventory(long projectId)
        {
            var query = new GetCurrentInventoryQuery(projectId);
            var result = await Mediator.Send(query);
            return Ok(result);
        }

        /// <summary>
        /// Lấy lịch sử biến động kho (thẻ kho) của một dự án, có phân trang.
        /// </summary>
        [HttpGet("transactions")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetInventoryTransactions(long projectId, [FromQuery] GetInventoryTransactionsQuery query)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy lịch sử biến động kho thành công");
        }
    }
}
