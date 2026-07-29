namespace BPG.Application.Features.Projects.Queries;


using BPG.Application.Common.Authorization;
using BPG.Application.Features.Projects.DTOs;
using MediatR;

public record GetProjectByIdQuery(long Id)
    : IRequest<ProjectDetailDto>, IProjectResourceRequirement
{
    public ProjectResource ProjectResource => ProjectResource.Project(Id);
}
