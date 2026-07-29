using BPG.Application.Common.Models;
using BPG.Application.DTOs.Suppliers;
using BPG.Application.Features.Suppliers.Commands;
using BPG.Application.Features.Suppliers.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    public class SuppliersController : BaseApiController
    {
        [HttpGet]
        [Authorize(Policy = SystemPermission.SuppliersView)]
        public async Task<IActionResult> GetSuppliers([FromQuery] GetSuppliersQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Lấy danh sách nhà cung cấp thành công");
        }

        [HttpGet("{id}")]
        [Authorize(Policy = SystemPermission.SuppliersView)]
        public async Task<IActionResult> GetSupplierById(long id)
        {
            var result = await Mediator.Send(new GetSupplierByIdQuery(id));
            return ApiOk(result, "Lấy thông tin nhà cung cấp thành công");
        }

        [HttpPost]
        [Authorize(Policy = SystemPermission.SuppliersManage)]
        public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierCommand command)
        {
            var result = await Mediator.Send(command);
            return ApiOk(result, "Tạo nhà cung cấp thành công");
        }

        [HttpPut("{id}")]
        [Authorize(Policy = SystemPermission.SuppliersManage)]
        public async Task<IActionResult> UpdateSupplier(long id, [FromBody] UpdateSupplierRequest request)
        {
            var result = await Mediator.Send(new UpdateSupplierCommand(
                id,
                request.SupplierName,
                request.ContactInfo,
                request.Address,
                request.ServiceArea,
                request.Rating,
                request.EvaluationNote,
                request.CollaborationStatus
            ));
            return ApiOk(result, "Cập nhật nhà cung cấp thành công");
        }

        [HttpDelete("{id}")]
        [Authorize(Policy = SystemPermission.SuppliersManage)]
        public async Task<IActionResult> DeleteSupplier(long id)
        {
            await Mediator.Send(new DeleteSupplierCommand(id));
            return ApiOk("Xóa nhà cung cấp thành công");
        }
    }
}
