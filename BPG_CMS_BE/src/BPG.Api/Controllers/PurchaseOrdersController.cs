using BPG.Application.Features.PurchaseOrders.Commands;
using BPG.Application.Features.PurchaseOrders.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class PurchaseOrdersController : BaseApiController
    {
        /// <summary>
        /// Danh sÃ¡ch PO, há»— trá»£ tÃ¬m kiáº¿m theo sá»‘ PO, lá»c theo tráº¡ng thÃ¡i vÃ  phÃ¢n trang.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = RolePolicies.Procurement)]
        public async Task<IActionResult> GetPurchaseOrders([FromQuery] GetPurchaseOrdersQuery query, CancellationToken ct)
        {
            query.ProjectId = null;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Láº¥y danh sÃ¡ch Ä‘Æ¡n mua hÃ ng thÃ nh cÃ´ng");
        }

        [HttpGet("/api/projects/{projectId:long}/purchase-orders")]
        public async Task<IActionResult> GetProjectPurchaseOrders(
            [FromRoute] long projectId,
            [FromQuery] GetPurchaseOrdersQuery query,
            CancellationToken ct)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Láº¥y danh sÃ¡ch Ä‘Æ¡n mua hÃ ng cá»§a dá»± Ã¡n thÃ nh cÃ´ng");
        }

        /// <summary>
        /// Láº¥y danh sÃ¡ch yÃªu cáº§u váº­t tÆ° Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t cá»§a má»™t dá»± Ã¡n Ä‘á»ƒ táº¡o PO.
        /// </summary>
        [HttpGet("approved-requests")]
        public async Task<IActionResult> GetApprovedRequests([FromQuery] long projectId, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetApprovedRequestsForPOQuery(projectId), ct);
            return Ok(result);
        }

        /// <summary>
        /// Láº¥y chi tiáº¿t má»™t Ä‘Æ¡n mua hÃ ng theo ID.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetPurchaseOrderById(long id, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetPurchaseOrderByIdQuery(id), ct);
            return Ok(result);
        }

        /// <summary>
        /// Xem trÆ°á»›c mÃ£ PO sáº½ Ä‘Æ°á»£c sinh náº¿u táº¡o Ä‘Æ¡n hÃ ng vÃ o ngÃ y chá»‰ Ä‘á»‹nh (chá»‰ tham kháº£o, cÃ³ thá»ƒ lá»‡ch
        /// náº¿u cÃ³ PO khÃ¡c Ä‘Æ°á»£c táº¡o xen giá»¯a lÃºc xem vÃ  lÃºc submit).
        /// </summary>
        [HttpGet("next-number")]
        [Authorize(Roles = RolePolicies.Procurement)]
        public async Task<IActionResult> GetNextPoNumber([FromQuery] DateTime orderDate, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetNextPoNumberQuery(orderDate), ct);
            return ApiOk(result, "Láº¥y mÃ£ Ä‘Æ¡n hÃ ng dá»± kiáº¿n thÃ nh cÃ´ng");
        }

        /// <summary>
        /// Táº¡o Ä‘Æ¡n mua hÃ ng (PO) tá»« cÃ¡c yÃªu cáº§u váº­t tÆ° Ä‘Ã£ duyá»‡t.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreatePurchaseOrder([FromBody] CreatePurchaseOrderCommand command, CancellationToken ct)
        {
            var poId = await Mediator.Send(command, ct);
            return ApiOk(poId, "Táº¡o Ä‘Æ¡n mua hÃ ng thÃ nh cÃ´ng");
        }

        /// <summary>
        /// Há»§y Ä‘Æ¡n mua hÃ ng (chá»‰ khi chÆ°a cÃ³ hÃ ng nháº­n), ghi lÃ½ do há»§y.
        /// </summary>
        [HttpPost("{id:long}/cancel")]
        public async Task<IActionResult> CancelPurchaseOrder(long id, [FromBody] CancelPORequestBody body, CancellationToken ct)
        {
            await Mediator.Send(new CancelPurchaseOrderCommand { POId = id, Reason = body.Reason }, ct);
            return ApiOk(true, "Há»§y Ä‘Æ¡n mua hÃ ng thÃ nh cÃ´ng");
        }

        /// <summary>
        /// ÄÃ³ng Ä‘Æ¡n mua hÃ ng Ä‘ang nháº­n má»™t pháº§n. Pháº§n váº­t tÆ° chÆ°a nháº­n sáº½ Ä‘Æ°á»£c tráº£ láº¡i
        /// yÃªu cáº§u váº­t tÆ°, cho phÃ©p táº¡o Ä‘Æ¡n mua hÃ ng khÃ¡c cho pháº§n cÃ²n thiáº¿u.
        /// </summary>
        [HttpPost("{id:long}/close")]
        public async Task<IActionResult> ClosePurchaseOrder(long id, [FromBody] CancelPORequestBody body, CancellationToken ct)
        {
            await Mediator.Send(new ClosePurchaseOrderCommand { POId = id, Reason = body.Reason }, ct);
            return ApiOk(true, "ÄÃ³ng Ä‘Æ¡n mua hÃ ng thÃ nh cÃ´ng");
        }
    }

    public class CancelPORequestBody
    {
        public string Reason { get; set; } = string.Empty;
    }
}

