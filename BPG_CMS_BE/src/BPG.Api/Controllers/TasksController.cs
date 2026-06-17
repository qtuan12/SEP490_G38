using BPG.Application.Features.Tasks.Commands.AdjustTaskProgress;
using BPG.Application.Features.Tasks.Commands.AssignTask;
using BPG.Application.Features.Tasks.Commands.CreateTask;
using BPG.Application.Features.Tasks.Commands.DeleteTask;
using BPG.Application.Features.Tasks.Commands.MarkTaskObsolete;
using BPG.Application.Features.Tasks.Commands.UpdateTask;
using BPG.Application.Features.Tasks.Queries.GetTaskDetails;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BPG.Api.Controllers;

[Route("api/tasks")]
[ApiController]
[Authorize]
public class TasksController : BaseApiController
{
    [HttpGet("{taskId}")]
    public async Task<IActionResult> GetTaskDetails([FromRoute] long taskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new GetTaskDetailsQuery(taskId), ct);
        return ApiOk(result);
    }

    [HttpPost("phases/{phaseId}")]
    public async Task<IActionResult> CreateTask([FromRoute] long phaseId, [FromBody] CreateTaskCommand command, CancellationToken ct)
    {
        if (phaseId != command.PhaseId)
            return BadRequest(new { Message = "PhaseId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}")]
    public async Task<IActionResult> UpdateTask([FromRoute] long taskId, [FromBody] UpdateTaskCommand command, CancellationToken ct)
    {
        if (taskId != command.TaskId)
            return BadRequest(new { Message = "TaskId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpDelete("{taskId}")]
    public async Task<IActionResult> DeleteTask([FromRoute] long taskId, CancellationToken ct)
    {
        var result = await Mediator.Send(new DeleteTaskCommand(taskId), ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/assignees")]
    public async Task<IActionResult> AssignTask([FromRoute] long taskId, [FromBody] AssignTaskCommand command, CancellationToken ct)
    {
        if (taskId != command.TaskId)
            return BadRequest(new { Message = "TaskId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/progress")]
    public async Task<IActionResult> AdjustTaskProgress([FromRoute] long taskId, [FromBody] AdjustTaskProgressCommand command, CancellationToken ct)
    {
        if (taskId != command.TaskId)
            return BadRequest(new { Message = "TaskId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }

    [HttpPut("{taskId}/obsolete")]
    public async Task<IActionResult> MarkTaskObsolete([FromRoute] long taskId, [FromBody] MarkTaskObsoleteCommand command, CancellationToken ct)
    {
        if (taskId != command.TaskId)
            return BadRequest(new { Message = "TaskId mismatch" });

        var result = await Mediator.Send(command, ct);
        return ApiOk(result);
    }
}
