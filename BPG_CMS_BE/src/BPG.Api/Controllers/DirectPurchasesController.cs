using BPG.Application.Features.DirectPurchases.Commands;
using BPG.Application.Features.DirectPurchases.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class DirectPurchasesController : BaseApiController
    {
        [HttpGet]
        public async Task<IActionResult> GetDirectPurchaseRequests([FromQuery] GetDirectPurchaseRequestsQuery query, CancellationToken ct)
        {
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result);
        }

        [HttpPost]
        public async Task<IActionResult> CreateDirectPurchaseRequest([FromBody] CreateDirectPurchaseRequestCommand command, CancellationToken ct)
        {
            var id = await Mediator.Send(command, ct);
            return ApiOk(new { directPurchaseId = id });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetDirectPurchaseById([FromRoute] long id, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetDirectPurchaseByIdQuery(id), ct);
            return ApiOk(result);
        }

        /// <summary>
        /// Kế toán kiểm toán phiếu mua khẩn cấp (đối chiếu hóa đơn để hoàn tiền/giải ngân).
        /// Không ảnh hưởng đến tồn kho.
        /// </summary>
        [HttpPatch("{id}/audit")]
        public async Task<IActionResult> AuditDirectPurchase([FromRoute] long id, [FromBody] AuditDirectPurchaseCommand command, CancellationToken ct)
        {
            command.DirectPurchaseId = id;
            var result = await Mediator.Send(command, ct);
            return ApiOk(result);
        }
    }
}
