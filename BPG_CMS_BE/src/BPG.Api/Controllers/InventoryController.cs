using BPG.Application.Features.Inventory.Queries;
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
        public async Task<IActionResult> GetInventoryTransactions([FromQuery] GetInventoryTransactionsQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy lịch sử biến động kho thành công");
        }
    }
}
