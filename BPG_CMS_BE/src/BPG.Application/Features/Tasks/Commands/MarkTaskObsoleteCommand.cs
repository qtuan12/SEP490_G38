using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record MarkTaskObsoleteCommand(
    long TaskId,
    string ObsoleteReason
) : IRequest<ApiResponse>;
