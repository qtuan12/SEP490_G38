using BPG.Application.Features.Tasks.Commands;
using BPG.Application.Features.Tasks.Queries.GetTaskDetails;
using BPG.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/tasks")]
[ApiController]
[Authorize]
public class TasksController : BaseApiController
{
    [HttpGet("{taskId}")]
    [Authorize(Roles = RolePolicies.ProjectViewers)]
    public async Task<IActionResult> GetTaskDetails([FromRoute] long taskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetTaskDetailsQuery(taskId), ct);
        return ApiOk(result);
    }

    [HttpPost("phases/{phaseId}")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> CreateTask([FromRoute] long phaseId, [FromBody] CreateTaskCommand command, CancellationToken ct)
    {
        var finalCommand = command with { PhaseId = phaseId };
        var result = await Mediator.Send(finalCommand, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> UpdateTask([FromRoute] long taskId, [FromBody] UpdateTaskCommand command, CancellationToken ct)
    {
        var finalCommand = command with { TaskId = taskId };
        var result = await Mediator.Send(finalCommand, ct);
        return ApiOk(result);
    }

    [HttpDelete("{taskId}")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> DeleteTask([FromRoute] long taskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new DeleteTaskCommand(taskId), ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/assignees")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> AssignTask([FromRoute] long taskId, [FromBody] AssignTaskCommand command, CancellationToken ct)
    {
        var finalCommand = command with { TaskId = taskId };
        var result = await Mediator.Send(finalCommand, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/progress")]
    [Authorize(Roles = RolePolicies.TechnicalManager)]
    public async Task<IActionResult> AdjustTaskProgress([FromRoute] long taskId, [FromBody] AdjustTaskProgressCommand command, CancellationToken ct)
    {
        var finalCommand = command with { TaskId = taskId };
        var result = await Mediator.Send(finalCommand, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/obsolete")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> MarkTaskObsolete([FromRoute] long taskId, [FromBody] MarkTaskObsoleteCommand command, CancellationToken ct)
    {
        var finalCommand = command with { TaskId = taskId };
        var result = await Mediator.Send(finalCommand, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/restore")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> RestoreTask([FromRoute] long taskId, CancellationToken ct)
    {
        var command = new RestoreTaskCommand(taskId);
        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPost("{taskId}/dependencies/{predecessorTaskId}")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> AddDependency([FromRoute] long taskId, [FromRoute] long predecessorTaskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new AddTaskDependencyCommand(taskId, predecessorTaskId), ct);
        return ApiOk(result);
    }

    [HttpDelete("{taskId}/dependencies/{predecessorTaskId}")]
    [Authorize(Roles = RolePolicies.TechnicalManagerOrSiteEngineer)]
    public async Task<IActionResult> RemoveDependency([FromRoute] long taskId, [FromRoute] long predecessorTaskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new RemoveTaskDependencyCommand(taskId, predecessorTaskId), ct);
        return ApiOk(result);
    }
}
