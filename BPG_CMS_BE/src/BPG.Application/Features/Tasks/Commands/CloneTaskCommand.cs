using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record CloneTaskCommand(long TaskId) : IRequest<ApiResponse<long>>;
