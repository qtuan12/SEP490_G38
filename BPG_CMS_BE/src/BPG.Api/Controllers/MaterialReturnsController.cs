using BPG.Application.Features.MaterialReturns.Commands;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
using BPG.Application.Features.MaterialReturns.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class MaterialReturnsController : BaseApiController
    {
        /// <summary>
        /// Tạo phiếu hoàn trả vật tư từ công trường về kho.
        /// Chỉ Kỹ sư công trường (SiteEngineer) và Quản lý Kỹ thuật (TechnicalManager) được phép.
        /// Phiếu hoàn trả phải gắn với phiếu xuất kho gốc (OriginalIssuanceId).
        /// </summary>
        [HttpPost]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = UserRole.SiteEngineer)]
        public async Task<IActionResult> CreateMaterialReturn([FromBody] CreateMaterialReturnCommand command)
        {
            var result = await Mediator.Send(command);
            return Ok(result);
        }

        /// <summary>
        /// Lấy danh sách phiếu hoàn trả vật tư.
        /// Có thể lọc theo ProjectId hoặc IssuanceId (để xem lịch sử hoàn trả của 1 phiếu xuất cụ thể).
        /// </summary>
        [HttpGet]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetMaterialReturns([FromQuery] GetMaterialReturnsQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách phiếu hoàn trả thành công");
        }

        /// <summary>
        /// Lấy chi tiết một phiếu hoàn trả vật tư cụ thể, kèm danh sách vật tư đã trả.
        /// </summary>
        [HttpGet("{id:long}")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetMaterialReturnDetail(long id)
        {
            var query = new GetMaterialReturnDetailQuery(id);
            var result = await Mediator.Send(query);
            return Ok(result);
        }
    }
}
