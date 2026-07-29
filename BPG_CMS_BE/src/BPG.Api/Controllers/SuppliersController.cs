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
        [Authorize(Roles = RolePolicies.SupplierViewers)]
        public async Task<IActionResult> GetSuppliers([FromQuery] GetSuppliersQuery query)
        {
            var result = await Mediator.Send(query);
            return ApiPagedOk(result, "Láº¥y danh sÃ¡ch nhÃ  cung cáº¥p thÃ nh cÃ´ng");
        }

        [HttpGet("{id}")]
        [Authorize(Roles = RolePolicies.SupplierViewers)]
        public async Task<IActionResult> GetSupplierById(long id)
        {
            var result = await Mediator.Send(new GetSupplierByIdQuery(id));
            return ApiOk(result, "Láº¥y thÃ´ng tin nhÃ  cung cáº¥p thÃ nh cÃ´ng");
        }

        [HttpPost]
        [Authorize(Roles = RolePolicies.SupplierManagers)]
        public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierCommand command)
        {
            var result = await Mediator.Send(command);
            return ApiOk(result, "Táº¡o nhÃ  cung cáº¥p thÃ nh cÃ´ng");
        }

        [HttpPut("{id}")]
        [Authorize(Roles = RolePolicies.SupplierManagers)]
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
            return ApiOk(result, "Cáº­p nháº­t nhÃ  cung cáº¥p thÃ nh cÃ´ng");
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = RolePolicies.SupplierManagers)]
        public async Task<IActionResult> DeleteSupplier(long id)
        {
            await Mediator.Send(new DeleteSupplierCommand(id));
            return ApiOk("XÃ³a nhÃ  cung cáº¥p thÃ nh cÃ´ng");
        }
    }
}

