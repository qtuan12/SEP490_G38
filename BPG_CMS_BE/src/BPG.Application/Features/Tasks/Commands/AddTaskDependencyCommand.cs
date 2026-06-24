using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record AddTaskDependencyCommand(
    long TaskId,
    long PredecessorTaskId
) : IRequest<ApiResponse>;
