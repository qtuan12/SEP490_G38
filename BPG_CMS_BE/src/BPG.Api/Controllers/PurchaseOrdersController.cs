using BPG.Application.Features.PurchaseOrders.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class PurchaseOrdersController : BaseApiController
    {
        /// <summary>
        /// Lấy danh sách đơn mua hàng PO, hỗ trợ lọc theo ProjectId và trạng thái PO.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetPurchaseOrders([FromQuery] long? projectId, [FromQuery] string? status)
        {
            var query = new GetPurchaseOrdersQuery(projectId, status);
            var result = await Mediator.Send(query);
            return Ok(result);
        }
    }
}
