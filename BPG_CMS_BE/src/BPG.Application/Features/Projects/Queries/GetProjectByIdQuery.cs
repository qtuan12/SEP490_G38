namespace BPG.Application.Features.Projects.Queries;


using BPG.Application.Features.Projects.DTOs;
using MediatR;

public record GetProjectByIdQuery(long Id)
    : IRequest<ProjectDetailDto>
{
}

