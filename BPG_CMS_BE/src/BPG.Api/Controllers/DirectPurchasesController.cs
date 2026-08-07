using BPG.Application.Features.DirectPurchases.Commands;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
using BPG.Application.Features.DirectPurchases.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class DirectPurchasesController : BaseApiController
    {
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetDirectPurchaseRequests([FromQuery] GetDirectPurchaseRequestsQuery query, CancellationToken ct)
        {
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Lấy danh sách phiếu mua trực tiếp thành công");
        }

        /// <summary>
        /// Tạo phiếu mua trực tiếp ở trạng thái NHÁP. Chưa sinh PO/Phiếu nhập kho/tồn kho.
        /// </summary>
        [HttpPost]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> CreateDirectPurchaseRequest([FromBody] CreateDirectPurchaseRequestCommand command, CancellationToken ct)
        {
            var id = await Mediator.Send(command, ct);
            return ApiOk(new { directPurchaseId = id },
                "Lưu phiếu nháp thành công. Phiếu chưa được gửi nên chưa ảnh hưởng tồn kho.");
        }

        /// <summary>Sửa phiếu nháp. Chỉ người tạo, chỉ khi Status = Draft.</summary>
        [HttpPut("{id}")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> UpdateDirectPurchaseDraft([FromRoute] long id, [FromBody] UpdateDirectPurchaseDraftCommand command, CancellationToken ct)
        {
            command.DirectPurchaseId = id;
            var result = await Mediator.Send(command, ct);
            return ApiOk(result, "Cập nhật phiếu nháp thành công. Phiếu chưa được gửi nên chưa ảnh hưởng tồn kho.");
        }

        /// <summary>Xóa phiếu nháp. Chỉ người tạo, chỉ khi Status = Draft.</summary>
        [HttpDelete("{id}")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> DeleteDirectPurchaseDraft([FromRoute] long id, CancellationToken ct)
        {
            var result = await Mediator.Send(new DeleteDirectPurchaseDraftCommand(id), ct);
            return ApiOk(result, "Xóa phiếu nháp thành công");
        }

        /// <summary>
        /// Gửi phiếu nháp. Hệ thống sinh Đơn hàng + Phiếu nhập kho và cộng tồn kho ngay.
        /// Phiếu vượt định mức BOQ sẽ chuyển sang luồng Kế toán soát hóa đơn -> Giám đốc duyệt chi.
        /// </summary>
        [HttpPost("{id}/submit")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> SubmitDirectPurchase([FromRoute] long id, CancellationToken ct)
        {
            // Handler trả về message vì chỉ nó biết phiếu rơi vào nhánh trong hay vượt định mức BOQ.
            var message = await Mediator.Send(new SubmitDirectPurchaseCommand(id), ct);
            return ApiOk(true, message);
        }

        [HttpGet("{id}")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetDirectPurchaseById([FromRoute] long id, CancellationToken ct)
        {
            var result = await Mediator.Send(new GetDirectPurchaseByIdQuery(id), ct);
            return ApiOk(result, "Lấy chi tiết phiếu mua trực tiếp thành công");
        }

        /// <summary>
        /// Kế toán đối chiếu hóa đơn. Không ảnh hưởng đến tồn kho.
        /// Phiếu trong định mức: đây là bước cuối. Phiếu vượt định mức: trình tiếp Giám đốc.
        /// </summary>
        [HttpPatch("{id}/audit")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Accountant)]
        public async Task<IActionResult> AuditDirectPurchase([FromRoute] long id, [FromBody] AuditDirectPurchaseCommand command, CancellationToken ct)
        {
            command.DirectPurchaseId = id;
            // Handler trả về message vì kết quả khác nhau giữa phiếu trong và vượt định mức BOQ.
            var message = await Mediator.Send(command, ct);
            return ApiOk(true, message);
        }

        /// <summary>
        /// Giám đốc duyệt chi phiếu vượt định mức. Không ảnh hưởng tồn kho.
        /// </summary>
        [HttpPatch("{id}/director-approve")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Director)]
        public async Task<IActionResult> DirectorApprove([FromRoute] long id, [FromBody] ApproveDirectPurchaseByDirectorCommand command, CancellationToken ct)
        {
            command.DirectPurchaseId = id;
            var result = await Mediator.Send(command, ct);
            return ApiOk(result, "Duyệt chi phiếu mua trực tiếp vượt định mức thành công");
        }

        /// <summary>
        /// Giám đốc từ chối duyệt chi. Vật tư vẫn đã nhập kho, chỉ là không hoàn tiền.
        /// </summary>
        [HttpPatch("{id}/reject")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Director)]
        public async Task<IActionResult> DirectorReject([FromRoute] long id, [FromBody] RejectDirectPurchaseByDirectorCommand command, CancellationToken ct)
        {
            command.DirectPurchaseId = id;
            var result = await Mediator.Send(command, ct);
            return ApiOk(result, "Từ chối duyệt chi thành công. Vật tư vẫn đã nhập kho và vẫn tính vào định mức giai đoạn.");
        }
    }
}
