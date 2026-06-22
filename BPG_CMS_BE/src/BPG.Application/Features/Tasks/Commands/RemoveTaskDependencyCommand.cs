using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record RemoveTaskDependencyCommand(
    long TaskId,
    long PredecessorTaskId
) : IRequest<ApiResponse>;
