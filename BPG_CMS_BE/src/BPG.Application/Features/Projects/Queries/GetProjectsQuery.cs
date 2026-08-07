namespace BPG.Application.Features.Projects.Queries;

using BPG.Application.Common.Models;
using BPG.Application.Features.Projects.DTOs;
using MediatR;

public class GetProjectsQuery : PaginationRequest, IRequest<PagedList<ProjectDto>>
{
    public string? Status { get; set; }
    public bool ListAllActive { get; set; }
}
