using BPG.Application.Features.MaterialIssuances.Commands;
using BPG.Application.Features.MaterialIssuances.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class MaterialIssuancesController : BaseApiController
    {
        /// <summary>
        /// Tạo phiếu xuất kho vật tư thi công mới.
        /// Chỉ Kỹ sư công trường (SiteEngineer) và Quản lý Kỹ thuật (TechnicalManager) mới được tạo phiếu xuất.
        /// Đây là thao tác nghiệp vụ thực tế: thủ kho / kỹ sư hiện trường mới có thẩm quyền xuất vật tư.
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateMaterialIssuance([FromBody] CreateMaterialIssuanceCommand command)
        {
            var result = await Mediator.Send(command);
            return Ok(result);
        }

        /// <summary>
        /// Lấy danh sách phiếu xuất kho vật tư, có lọc theo dự án (ProjectId) và phân trang.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMaterialIssuances([FromQuery] GetMaterialIssuancesQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách phiếu xuất kho thành công");
        }

        /// <summary>
        /// Lấy chi tiết một phiếu xuất kho vật tư cụ thể.
        /// </summary>
        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetMaterialIssuanceDetail(long id)
        {
            var query = new GetMaterialIssuanceDetailQuery(id);
            var result = await Mediator.Send(query);
            return Ok(result);
        }
    }
}
