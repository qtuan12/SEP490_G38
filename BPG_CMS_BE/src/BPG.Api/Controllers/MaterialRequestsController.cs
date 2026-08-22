using BPG.Application.Features.MaterialRequests.Commands;
using Microsoft.AspNetCore.RateLimiting;
using BPG.Api.Configuration;
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
        public async Task<IActionResult> CreateMaterialRequest(
            [FromRoute] long projectId,
            [FromBody] CreateMaterialRequestCommand command,
            CancellationToken ct)
        {
            if (projectId != command.ProjectId)
            {
                return ApiBadRequest("Mã dự án không khớp.");
            }
            var result = await Mediator.Send(command, ct);
            return Ok(result);
        }

        [HttpGet("/api/projects/{projectId}/material-requests")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetProjectMaterialRequests(
            [FromRoute] long projectId,
            [FromQuery] GetMaterialRequestsQuery query,
            CancellationToken ct)
        {
            query.ProjectId = projectId;
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Lấy danh sách đề xuất vật tư của dự án thành công.");
        }

        [HttpGet]
        [Authorize(Roles = RolePolicies.Procurement)]
        public async Task<IActionResult> GetAllMaterialRequests(
            [FromQuery] GetMaterialRequestsQuery query,
            CancellationToken ct)
        {
            var result = await Mediator.Send(query, ct);
            return ApiPagedOk(result, "Lấy danh sách toàn bộ đề xuất vật tư thành công.");
        }

        [HttpGet("{id:long}")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.ProjectViewers)]
        public async Task<IActionResult> GetMaterialRequestDetail(
            [FromRoute] long id,
            CancellationToken ct)
        {
            var result = await Mediator.Send(new GetMaterialRequestDetailQuery(id), ct);
            return Ok(result);
        }

        [HttpGet("{id:long}/assessment")]
        [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
        [Authorize(Roles = RolePolicies.Procurement)]
        public async Task<IActionResult> GetMaterialRequestAssessment(
            [FromRoute] long id,
            CancellationToken ct)
        {
            var result = await Mediator.Send(new GetMaterialRequestAssessmentQuery(id), ct);
            return ApiOk(result, "Lấy cơ sở thẩm định yêu cầu vật tư thành công.");
        }

        [HttpPost("{id:long}/cancel")]
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Accountant)]
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.Director)]
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = UserRole.Accountant + "," + UserRole.Director)]
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
        [EnableRateLimiting(RateLimitPolicies.Mutation)]
        [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
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
