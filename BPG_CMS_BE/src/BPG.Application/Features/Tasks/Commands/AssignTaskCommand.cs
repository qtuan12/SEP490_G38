using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record AssignTaskCommand(long TaskId, List<long> AssigneeIds) : IRequest<ApiResponse>;
