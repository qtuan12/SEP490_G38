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
        /// Danh sách PO, hỗ trợ tìm kiếm theo số PO, lọc theo trạng thái và phân trang.
        /// </summary>
        [HttpGet]
        [Authorize(Policy = SystemPermission.ProcurementManage)]
        public async Task<IActionResult> GetPurchaseOrders([FromQuery] GetPurchaseOrdersQuery query, CancellationToken ct)
        {
            query.ProjectId = null;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Lấy danh sách đơn mua hàng thành công");
        }

        [HttpGet("/api/projects/{projectId:long}/purchase-orders")]
        public async Task<IActionResult> GetProjectPurchaseOrders(
            [FromRoute] long projectId,
            [FromQuery] GetPurchaseOrdersQuery query,
            CancellationToken ct)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Lấy danh sách đơn mua hàng của dự án thành công");
        }

        /// <summary>
        /// Lấy danh sách yêu cầu vật tư đã được duyệt của một dự án để tạo PO.
        /// </summary>
        [HttpGet("approved-requests")]
        public async Task<IActionResult> GetApprovedRequests([FromQuery] long projectId, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetApprovedRequestsForPOQuery(projectId), ct);
            return Ok(result);
        }

        /// <summary>
        /// Lấy chi tiết một đơn mua hàng theo ID.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetPurchaseOrderById(long id, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetPurchaseOrderByIdQuery(id), ct);
            return Ok(result);
        }

        /// <summary>
        /// Xem trước mã PO sẽ được sinh nếu tạo đơn hàng vào ngày chỉ định (chỉ tham khảo, có thể lệch
        /// nếu có PO khác được tạo xen giữa lúc xem và lúc submit).
        /// </summary>
        [HttpGet("next-number")]
        [Authorize(Policy = SystemPermission.ProcurementManage)]
        public async Task<IActionResult> GetNextPoNumber([FromQuery] DateTime orderDate, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetNextPoNumberQuery(orderDate), ct);
            return ApiOk(result, "Lấy mã đơn hàng dự kiến thành công");
        }

        /// <summary>
        /// Tạo đơn mua hàng (PO) từ các yêu cầu vật tư đã duyệt.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreatePurchaseOrder([FromBody] CreatePurchaseOrderCommand command, CancellationToken ct)
        {
            var poId = await Mediator.Send(command, ct);
            return ApiOk(poId, "Tạo đơn mua hàng thành công");
        }

        /// <summary>
        /// Hủy đơn mua hàng (chỉ khi chưa có hàng nhận), ghi lý do hủy.
        /// </summary>
        [HttpPost("{id:long}/cancel")]
        public async Task<IActionResult> CancelPurchaseOrder(long id, [FromBody] CancelPORequestBody body, CancellationToken ct)
        {
            await Mediator.Send(new CancelPurchaseOrderCommand { POId = id, Reason = body.Reason }, ct);
            return ApiOk(true, "Hủy đơn mua hàng thành công");
        }

        /// <summary>
        /// Đóng đơn mua hàng đang nhận một phần. Phần vật tư chưa nhận sẽ được trả lại
        /// yêu cầu vật tư, cho phép tạo đơn mua hàng khác cho phần còn thiếu.
        /// </summary>
        [HttpPost("{id:long}/close")]
        public async Task<IActionResult> ClosePurchaseOrder(long id, [FromBody] CancelPORequestBody body, CancellationToken ct)
        {
            await Mediator.Send(new ClosePurchaseOrderCommand { POId = id, Reason = body.Reason }, ct);
            return ApiOk(true, "Đóng đơn mua hàng thành công");
        }
    }

    public class CancelPORequestBody
    {
        public string Reason { get; set; } = string.Empty;
    }
}
