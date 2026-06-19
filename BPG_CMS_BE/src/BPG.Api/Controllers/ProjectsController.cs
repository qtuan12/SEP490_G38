namespace BPG.Api.Controllers;

using BPG.Application.Common.Models;

using BPG.Application.Features.Projects.Commands;
using BPG.Application.Features.Projects.DTOs;
using BPG.Application.Features.Projects.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

public class ProjectsController : BaseApiController
{
    [HttpGet("metrics")]
    [Authorize(Roles = "Director, TechnicalManager")]
    public async Task<IActionResult> GetDashboardMetrics()
    {
        var result = await Mediator.Send(new GetDashboardMetricsQuery());
        return ApiOk(result);
    }

    [HttpGet("dashboard/warnings")]
    [Authorize(Roles = "Director, TechnicalManager")]
    public async Task<IActionResult> GetDashboardWarnings()
    {
        var result = await Mediator.Send(new GetDashboardWarningsQuery());
        return ApiOk(result);
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetProjects([FromQuery] GetProjectsQuery query)
    {
        var result = await Mediator.Send(query);
        return ApiPagedOk(result);
    }

    [HttpGet("{id}")]
    [Authorize]
    public async Task<IActionResult> GetProjectById(long id)
    {
        var result = await Mediator.Send(new GetProjectByIdQuery(id));
        return ApiOk(result);
    }

    [HttpPost]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> CreateProject([FromBody] CreateProjectCommand command)
    {
        var result = await Mediator.Send(command);
        return ApiOk(result, "Tạo dự án thành công.");
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> UpdateProject(long id, [FromBody] UpdateProjectCommand command)
    {
        if (id != command.ProjectId) return ApiBadRequest("Id trong URL và Body không khớp.");
        var result = await Mediator.Send(command);
        return ApiOk(result, "Cập nhật dự án thành công.");
    }

    [HttpPut("{id}/activate")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> ActivateProject(long id)
    {
        await Mediator.Send(new ActivateProjectCommand(id));
        return ApiOk("Kích hoạt dự án thành công.");
    }

    [HttpPut("{id}/pause")]
    [Authorize(Roles = "TechnicalManager, Director")]
    public async Task<IActionResult> PauseProject(long id, [FromBody] PauseProjectCommand command)
    {
        if (id != command.ProjectId) return ApiBadRequest("Id trong URL và Body không khớp.");
        await Mediator.Send(command);
        return ApiOk("Tạm dừng dự án thành công.");
    }

    [HttpPut("{id}/resume")]
    [Authorize(Roles = "TechnicalManager, Director")]
    public async Task<IActionResult> ResumeProject(long id)
    {
        await Mediator.Send(new ResumeProjectCommand { ProjectId = id });
        return ApiOk("Tiếp tục dự án thành công.");
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> DeleteProject(long id)
    {
        await Mediator.Send(new DeleteProjectCommand { ProjectId = id });
        return ApiOk("Xóa dự án thành công.");
    }

    [HttpPost("{id}/members")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> AddProjectMember(long id, [FromBody] AddProjectMemberCommand command)
    {
        if (id != command.ProjectId) return ApiBadRequest("Id trong URL và Body không khớp.");
        var result = await Mediator.Send(command);
        return ApiOk(result, "Thêm thành viên thành công.");
    }

    [HttpDelete("{id}/members/{userId}")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> RemoveProjectMember(long id, long userId)
    {
        await Mediator.Send(new RemoveProjectMemberCommand { ProjectId = id, UserId = userId });
        return ApiOk("Xóa thành viên thành công.");
    }

    [HttpPut("{id}/members/{userId}/leader")]
    [Authorize(Roles = "TechnicalManager")]
    public async Task<IActionResult> AssignProjectLeader(long id, long userId)
    {
        await Mediator.Send(new AssignProjectLeaderCommand { ProjectId = id, UserId = userId });
        return ApiOk("Gán chức vụ Nhóm trưởng thành công.");
    }
}
