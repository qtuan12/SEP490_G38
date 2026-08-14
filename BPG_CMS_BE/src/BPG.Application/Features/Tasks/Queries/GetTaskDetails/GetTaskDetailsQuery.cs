using BPG.Application.Common.Models;
using BPG.Application.DTOs.Tasks;
using MediatR;

namespace BPG.Application.Features.Tasks.Queries.GetTaskDetails;

public record GetTaskDetailsQuery(long TaskId)
    : IRequest<ApiResponse<TaskDetailsDto>>
{
}

