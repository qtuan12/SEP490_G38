using BPG.Application.Features.MaterialRequests.Commands;
using BPG.Application.Features.MaterialRequests.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading;
using System.Threading.Tasks;

namespace BPG.Api.Controllers
{
    [Authorize]
    public class MaterialRequestsController : BaseApiController
    {
        [HttpPost("/api/projects/{projectId}/material-requests")]
        public async Task<IActionResult> CreateMaterialRequest(
            [FromRoute] long projectId,
            [FromBody] CreateMaterialRequestCommand command,
            CancellationToken ct)
        {
            if (projectId != command.ProjectId)
            {
                return ApiBadRequest("MÃ£ dá»± Ã¡n khÃ´ng khá»›p.");
            }
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpGet("/api/projects/{projectId}/material-requests")]
        public async Task<IActionResult> GetProjectMaterialRequests(
            [FromRoute] long projectId,
            [FromQuery] GetMaterialRequestsQuery query,
            CancellationToken ct)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Láº¥y danh sÃ¡ch Ä‘á» xuáº¥t váº­t tÆ° cá»§a dá»± Ã¡n thÃ nh cÃ´ng.");
        }

        [HttpGet]
        [Authorize(Roles = RolePolicies.Procurement)]
        public async Task<IActionResult> GetAllMaterialRequests(
            [FromQuery] GetMaterialRequestsQuery query,
            CancellationToken ct)
        {
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Láº¥y danh sÃ¡ch toÃ n bá»™ Ä‘á» xuáº¥t váº­t tÆ° thÃ nh cÃ´ng.");
        }

        [HttpGet("{id:long}")]
        public async Task<IActionResult> GetMaterialRequestDetail(
            [FromRoute] long id,
            CancellationToken ct)
        {
            var result = await Mediator.Send(new GetMaterialRequestDetailQuery(id), ct);
            return Ok(result);
        }

        [HttpPost("{id:long}/cancel")]
        public async Task<IActionResult> CancelMaterialRequest(
            [FromRoute] long id,
            [FromBody] CancelMaterialRequestRequest request,
            CancellationToken ct)
        {
            var command = new CancelMaterialRequestCommand(id, request.Reason);
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpPost("{id:long}/accountant-process")]
        public async Task<IActionResult> AccountantProcess(
            [FromRoute] long id,
            [FromBody] ProcessMaterialRequestRequest request,
            CancellationToken ct)
        {
            var command = new ProcessMaterialRequestByAccountantCommand(id, request.Note);
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpPost("{id:long}/director-approve")]
        public async Task<IActionResult> DirectorApprove(
            [FromRoute] long id,
            [FromBody] ApproveMaterialRequestRequest request,
            CancellationToken ct)
        {
            var command = new ApproveMaterialRequestByDirectorCommand(id, request.Note);
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpPost("{id:long}/reject")]
        public async Task<IActionResult> RejectMaterialRequest(
            [FromRoute] long id,
            [FromBody] RejectMaterialRequestRequest request,
            CancellationToken ct)
        {
            var command = new RejectMaterialRequestCommand(id, request.Reason);
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpPost("{id:long}/resubmit")]
        public async Task<IActionResult> ResubmitMaterialRequest(
            [FromRoute] long id,
            [FromBody] ResubmitMaterialRequestRequest request,
            CancellationToken ct)
        {
            var command = new ResubmitMaterialRequestCommand(id, request.Reason, request.Items);
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }
    }

    public record CancelMaterialRequestRequest(string Reason);
    public record ProcessMaterialRequestRequest(string? Note);
    public record ApproveMaterialRequestRequest(string? Note);
    public record RejectMaterialRequestRequest(string Reason);
    public record ResubmitMaterialRequestRequest(
        string Reason,
        List<BPG.Application.Features.MaterialRequests.Commands.MaterialRequestItemInput> Items
    );
}

