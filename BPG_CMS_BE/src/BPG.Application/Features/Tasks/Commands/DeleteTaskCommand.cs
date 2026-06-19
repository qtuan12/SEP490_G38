using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record DeleteTaskCommand(long TaskId) : IRequest<ApiResponse>;
