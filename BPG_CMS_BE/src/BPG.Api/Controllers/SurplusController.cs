using BPG.Application.Features.Surplus.Commands;
using BPG.Application.Features.Surplus.Queries;
using BPG.Application.DTOs.Surplus;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Authorize]
[Route("api/[controller]")]
public class SurplusController : BaseApiController
{
    // ============================================================
    // LIST / DETAIL
    // ============================================================

    /// <summary>
    /// Danh sách đề xuất xử lý vật tư thừa (Leader, Kế toán, TPKT).
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{UserRole.TechnicalManager},{UserRole.Accountant},SiteEngineer")]
    public async Task<IActionResult> GetList([FromQuery] GetSurplusRequestListQuery query, CancellationToken ct)
        => ApiPagedOk(await Mediator.Send(query, ct));

    /// <summary>
    /// Chi tiết một batch xử lý vật tư thừa: danh sách vật tư, số lượng, trạng thái, actions liên quan.
    /// </summary>
    [HttpGet("{surplusRequestId:long}")]
    [Authorize(Roles = $"{UserRole.TechnicalManager},{UserRole.Accountant},SiteEngineer")]
    public async Task<IActionResult> GetDetail(long surplusRequestId, CancellationToken ct)
        => ApiOk((await Mediator.Send(new GetSurplusRequestDetailQuery(surplusRequestId), ct)).Data);

    /// <summary>
    /// Danh sách các actions (Return/Transfer/Liquidation) của một SurplusRequestItem.
    /// </summary>
    [HttpGet("items/{surplusRequestItemId:long}/actions")]
    [Authorize(Roles = $"{UserRole.TechnicalManager},{UserRole.Accountant},SiteEngineer")]
    public async Task<IActionResult> GetActionList(long surplusRequestItemId, CancellationToken ct)
        => ApiOk((await Mediator.Send(new GetSurplusActionListQuery(surplusRequestItemId), ct)).Data);

    /// <summary>
    /// Danh sách các chuyến hàng chuyển đến cho một dự án.
    /// </summary>
    [HttpGet("projects/{projectId:long}/incoming-transfers")]
    [Authorize(Roles = "SiteEngineer,siteengineer")]
    public async Task<IActionResult> GetIncomingTransfers(long projectId, CancellationToken ct)
        => ApiOk((await Mediator.Send(new GetIncomingTransfersQuery(projectId), ct)).Data);

    // ============================================================
    // CREATE BATCH
    // ============================================================

    /// <summary>
    /// Leader tạo đề xuất xử lý vật tư thừa (auto tạo batch với toàn bộ tồn kho).
    /// </summary>
    [HttpPost("projects/{projectId:long}")]
    [Authorize(Roles = "SiteEngineer,siteengineer")] // ProjectLeader là SiteEngineer có IsLeader=true
    public async Task<IActionResult> CreateRequest(long projectId, [FromBody] CreateSurplusRequestBody body, CancellationToken ct)
        => ApiOk(await Mediator.Send(new CreateSurplusRequestCommand(projectId, body.Reason), ct));

    // ============================================================
    // ACTION: RETURN TO SUPPLIER (Accountant)
    // ============================================================

    /// <summary>
    /// Kế toán xử lý trả NCC: tạo action trả lại nhà cung cấp và giảm tồn kho.
    /// </summary>
    [HttpPost("items/{surplusRequestItemId:long}/return")]
    [Authorize(Roles = UserRole.Accountant)]
    public async Task<IActionResult> CreateReturnAction(long surplusRequestItemId, [FromForm] CreateSurplusReturnForm form, CancellationToken ct)
    {
        var command = new CreateSurplusReturnActionCommand(
            surplusRequestItemId, form.SupplierId, form.ReturnQuantity, form.RefundAmount, form.Note, form.Attachments);
        return ApiOk(await Mediator.Send(command, ct));
    }

    // ============================================================
    // ACTION: TRANSFER (Leader → TPKT → Sender → Receiver)
    // ============================================================

    /// <summary>
    /// Leader tạo action chuyển kho sang dự án khác (chờ TPKT duyệt).
    /// </summary>
    [HttpPost("items/{surplusRequestItemId:long}/transfer")]
    [Authorize(Roles = "SiteEngineer,siteengineer")]
    public async Task<IActionResult> CreateTransferAction(long surplusRequestItemId, [FromBody] CreateSurplusTransferBody body, CancellationToken ct)
        => ApiOk(await Mediator.Send(new CreateSurplusTransferActionCommand(
            surplusRequestItemId, body.ToProjectId, body.TransferQuantity), ct));

    /// <summary>
    /// TPKT duyệt hoặc từ chối đề xuất chuyển kho.
    /// </summary>
    [HttpPut("transfers/{surplusTransferId:long}/review")]
    [Authorize(Roles = UserRole.TechnicalManager)]
    public async Task<IActionResult> ReviewTransfer(long surplusTransferId, [FromBody] ReviewSurplusTransferBody body, CancellationToken ct)
        => ApiOk(await Mediator.Send(new ReviewSurplusTransferCommand(surplusTransferId, body.IsApproved), ct));

    /// <summary>
    /// Bên gửi xác nhận đã vận chuyển (Dispatched).
    /// </summary>
    [HttpPut("transfers/{surplusTransferId:long}/dispatch")]
    [Authorize(Roles = "SiteEngineer,siteengineer")]
    public async Task<IActionResult> DispatchTransfer(long surplusTransferId, [FromForm] DispatchTransferForm form, CancellationToken ct)
        => ApiOk(await Mediator.Send(new DispatchSurplusTransferCommand(surplusTransferId, form.Attachments), ct));

    /// <summary>
    /// Bên nhận xác nhận đã nhận hàng (Received) và cập nhật tồn kho hai chiều.
    /// </summary>
    [HttpPut("transfers/{surplusTransferId:long}/receive")]
    [Authorize(Roles = "SiteEngineer,siteengineer")]
    public async Task<IActionResult> ReceiveTransfer(long surplusTransferId, [FromForm] ReceiveTransferForm form, CancellationToken ct)
        => ApiOk(await Mediator.Send(new ReceiveSurplusTransferCommand(surplusTransferId, form.Attachments), ct));

    // ============================================================
    // ACTION: LIQUIDATION (Accountant)
    // ============================================================

    /// <summary>
    /// Kế toán xử lý thanh lý vật tư thừa: nhập giá trị thu hồi và hoàn tất.
    /// </summary>
    [HttpPost("items/{surplusRequestItemId:long}/liquidation")]
    [Authorize(Roles = UserRole.Accountant)]
    public async Task<IActionResult> CreateLiquidationAction(long surplusRequestItemId, [FromForm] CreateSurplusLiquidationForm form, CancellationToken ct)
    {
        var command = new CreateSurplusLiquidationActionCommand(
            surplusRequestItemId, form.BuyerName, form.LiquidationQuantity, form.TotalAmount, form.Attachments);
        return ApiOk(await Mediator.Send(command, ct));
    }
}

