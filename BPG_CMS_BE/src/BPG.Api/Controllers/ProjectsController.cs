namespace BPG.Api.Controllers;

using BPG.Api.Configuration;

using BPG.Application.Common.Models;
using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.RateLimiting;

[Authorize]
public class ProjectsController : BaseApiController
{
    [HttpGet("metrics")]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetDashboardMetrics()
    {
        var result = await Mediator.Send(new GetDashboardMetricsQuery());
        return ApiOk(result);
    }

    [HttpGet("dashboard/warnings")]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetDashboardWarnings()
    {
        var result = await Mediator.Send(new GetDashboardWarningsQuery());
        return ApiOk(result);
    }

    [HttpGet]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetProjects([FromQuery] GetProjectsQuery query)
    {
        var result = await Mediator.Send(query);
        return ApiPagedOk(result);
    }

    [HttpGet("{id}")]
    [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetProjectById(long id)
    {
        var result = await Mediator.Send(new GetProjectByIdQuery(id));
        return ApiOk(result);
    }

    [HttpGet("{id}/access")]
    [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetMyAccess(long id, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetMyProjectAccessQuery(id), ct);
        return ApiOk(result);
    }

    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Tao du an thanh cong.");
    }

    [HttpPut("{id}")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> UpdateProject(long id, [FromBody] UpdateProjectCommand command)
    {
        if (id != command.ProjectId)
            return ApiBadRequest("Id trong URL va Body khong khop.");

        var result = await Mediator.Send(command);
        return ApiOk(result, "Cap nhat du an thanh cong.");
    }

    [HttpPut("{id}/activate")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> ActivateProject(long id)
    {
        await Mediator.Send(new ActivateProjectCommand(id));
        return ApiOk("Kich hoat du an thanh cong.");
    }

    [HttpPut("{id}/pause")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> PauseProject(long id, [FromBody] PauseProjectCommand command)
    {
        if (id != command.ProjectId)
            return ApiBadRequest("Id trong URL va Body khong khop.");

        await Mediator.Send(command);
        return ApiOk("Tam dung du an thanh cong.");
    }

    [HttpPut("{id}/resume")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> ResumeProject(long id)
    {
        await Mediator.Send(new ResumeProjectCommand { ProjectId = id });
        return ApiOk("Tiep tuc du an thanh cong.");
    }

    [HttpPut("{id}/complete")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> CompleteProject(long id)
    {
        await Mediator.Send(new CompleteProjectCommand(id));
        return ApiOk("Hoan thanh du an thanh cong.");
    }

    [HttpDelete("{id}")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> DeleteProject(long id)
    {
        await Mediator.Send(new DeleteProjectCommand { ProjectId = id });
        return ApiOk("Xoa du an thanh cong.");
    }

    [HttpPost("{id}/members")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> AddProjectMember(long id, [FromBody] AddProjectMemberCommand command)
    {
        if (id != command.ProjectId)
            return ApiBadRequest("Id trong URL va Body khong khop.");

        var result = await Mediator.Send(command);
        return ApiOk(result, "Them thanh vien thanh cong.");
    }

    [HttpGet("{id}/available-members")]
    [EnableRateLimiting(RateLimitPolicies.QueryDetail)]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> GetAvailableProjectMembers(long id, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetAvailableProjectMembersQuery(id), ct);
        return ApiOk(result);
    }

    [HttpDelete("{id}/members/{userId}")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> RemoveProjectMember(long id, long userId)
    {
        await Mediator.Send(new RemoveProjectMemberCommand { ProjectId = id, UserId = userId });
        return ApiOk("Xoa thanh vien thanh cong.");
    }

    [HttpPut("{id}/members/{userId}/leader")]
    [EnableRateLimiting(RateLimitPolicies.Mutation)]
    [Authorize(Roles = RolePolicies.DirectorOrTechnicalManager)]
    public async Task<IActionResult> AssignProjectLeader(long id, long userId)
    {
        await Mediator.Send(new AssignProjectLeaderCommand { ProjectId = id, UserId = userId });
        return ApiOk("Gan chuc vu truong nhom thanh cong.");
    }
}
