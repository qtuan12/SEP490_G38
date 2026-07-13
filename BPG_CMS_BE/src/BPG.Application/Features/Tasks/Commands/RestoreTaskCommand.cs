using BPG.Application.Common.Models;
using MediatR;

namespace BPG.Application.Features.Tasks.Commands;

public record RestoreTaskCommand(long TaskId) : IRequest<ApiResponse>;
