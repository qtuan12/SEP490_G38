using BPG.Application.Features.GoodsReceipts.Commands;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
using BPG.Application.Features.GoodsReceipts.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class GoodsReceiptsController : BaseApiController
    {
        /// <summary>
        /// Tạo phiếu nhập kho mới từ đơn mua hàng PO.
        /// </summary>
        [HttpPost]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = UserRole.SiteEngineer)]
        public async Task<IActionResult> CreateGoodsReceipt([FromBody] CreateGoodsReceiptCommand command)
        {
            var result = await Mediator.Send(command);
            return Ok(result);
        }

        /// <summary>
        /// Lấy danh sách phiếu nhập kho, có lọc theo dự án (ProjectId) và phân trang.
        /// </summary>
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetGoodsReceipts([FromQuery] GetGoodsReceiptsQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách phiếu nhập kho thành công");
        }

        /// <summary>
        /// Lấy thông tin chi tiết của một phiếu nhập kho cụ thể.
        /// </summary>
        [HttpGet("{id:long}")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetGoodsReceiptDetail(long id)
        {
            var query = new GetGoodsReceiptDetailQuery(id);
            var result = await Mediator.Send(query);
            return Ok(result);
        }

        /// <summary>
        /// Cập nhật thông tin mô tả phiếu nhập kho (Tên người giao, Số phiếu NCC, Ảnh chứng từ).
        /// Mở cho mọi Site Engineer hoặc cấp quản lý để thuận tiện điều chỉnh lỗi nhập liệu thông tin.
        /// </summary>
        [HttpPatch("{id:long}/metadata")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = UserRole.SiteEngineer)]
        public async Task<IActionResult> PatchGoodsReceiptMetadata(long id, [FromBody] PatchGoodsReceiptMetadataCommand command)
        {
            if (id != command.ReceiptId)
            {
                return ApiBadRequest("Mã phiếu nhập kho không khớp.");
            }
            var result = await Mediator.Send(command);
            return Ok(result);
        }

        /// <summary>
        /// Hủy phiếu nhập kho đã duyệt (chỉ dành cho quản lý trở lên).
        /// Hệ thống sẽ kiểm tra tồn kho trước khi hủy để tránh bị âm kho.
        /// </summary>
        [HttpPost("{id:long}/cancel")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = UserRole.SiteEngineer)]
        public async Task<IActionResult> CancelGoodsReceipt(long id)
        {
            var command = new CancelGoodsReceiptCommand(id);
            var result = await Mediator.Send(command);
            return Ok(result);
        }
    }
}
